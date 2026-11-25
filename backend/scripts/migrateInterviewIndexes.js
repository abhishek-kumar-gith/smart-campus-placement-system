const mongoose = require('mongoose');
const env = require('../src/config/env');

const COMPOUND_INDEX = {
  name: 'applicationId_1_round_1',
  key: { applicationId: 1, round: 1 },
};

const findLegacyApplicationIndex = (indexes) =>
  indexes.find((index) =>
    index.unique
    && index.key
    && Object.keys(index.key).length === 1
    && index.key.applicationId === 1);

const up = async (collection) => {
  const indexes = await collection.indexes();
  const legacyIndex = findLegacyApplicationIndex(indexes);
  if (legacyIndex) {
    await collection.dropIndex(legacyIndex.name);
  }
  const compoundExists = await collection
    .indexes()
    .then((current) =>
      current.some((index) =>
        index.name === COMPOUND_INDEX.name
        || (index.unique
          && index.key.applicationId === 1
          && index.key.round === 1)));
  if (!compoundExists) {
    await collection.createIndex(
      COMPOUND_INDEX.key,
      { name: COMPOUND_INDEX.name, unique: true },
    );
  }
  return {
    droppedLegacyIndex: Boolean(legacyIndex),
    compoundIndexReady: true,
  };
};

const down = async (collection) => {
  const indexes = await collection.indexes();
  const compoundIndex = indexes.find((index) =>
    index.name === COMPOUND_INDEX.name
    || (index.unique
      && index.key.applicationId === 1
      && index.key.round === 1));
  if (compoundIndex) await collection.dropIndex(compoundIndex.name);

  const duplicateApplications = await collection.aggregate([
    { $group: { _id: '$applicationId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  ]).toArray();
  if (duplicateApplications.length) {
    throw new Error(
      'Cannot recreate the legacy unique applicationId index: multiple rounds exist for at least one application.',
    );
  }

  const legacyExists = await collection.indexes()
    .then((current) =>
      current.some((index) =>
        index.unique
        && index.key.applicationId === 1
        && Object.keys(index.key).length === 1));
  if (!legacyExists) {
    await collection.createIndex(
      { applicationId: 1 },
      { name: 'applicationId_1', unique: true },
    );
  }
  return { compoundIndexDropped: Boolean(compoundIndex), legacyIndexReady: true };
};

if (require.main === module) {
  const direction = process.argv[2];
  if (!['up', 'down'].includes(direction)) {
    console.error('Usage: node scripts/migrateInterviewIndexes.js <up|down>');
    process.exit(1);
  }
  if (env.NODE_ENV === 'production') {
    console.error('Interview index migration cannot run in production. Use an isolated database only.');
    process.exit(1);
  }
  if (!env.MONGODB_URI) {
    console.error('MONGODB_URI is required for migrations.');
    process.exit(1);
  }
  mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
    .then(async () => {
      const collection = mongoose.connection.collection('interviews');
      const result = direction === 'up'
        ? await up(collection)
        : await down(collection);
      console.log(JSON.stringify(result));
      await mongoose.disconnect();
    })
    .catch(async (error) => {
      console.error(error.message);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { up, down, findLegacyApplicationIndex };

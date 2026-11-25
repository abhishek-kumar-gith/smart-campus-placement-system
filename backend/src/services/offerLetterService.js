const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');

const defaultOfferRoot = path.join(__dirname, '../../uploads/offer-letters');
const defaultLogoRoot = path.join(__dirname, '../../uploads/logos');
const storedFilePattern = /^offer-[a-f0-9-]+\.pdf$/i;

const generateOfferLetterPdf = (offer, options = {}) => {
  const offerRoot = options.offerRoot || defaultOfferRoot;
  fs.mkdirSync(offerRoot, { recursive: true });
  const storedFileName = `offer-${crypto.randomUUID()}.pdf`;
  const storedFilePath = path.resolve(offerRoot, storedFileName);
  const originalFileName = `Offer-${String(offer.offerLetterNumber).replace(/[^a-z0-9-]/gi, '-')}.pdf`;

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(storedFilePath, { flags: 'wx' });
    const document = new PDFDocument({ size: 'A4', margin: 54, info: { Title: `Offer ${offer.offerLetterNumber}` } });
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      output.destroy();
      if (fs.existsSync(storedFilePath)) fs.unlinkSync(storedFilePath);
      reject(error);
    };
    output.on('error', fail);
    output.on('finish', () => {
      if (settled) return;
      settled = true;
      resolve({
        storedFileName,
        originalFileName,
        fileSize: fs.statSync(storedFilePath).size,
        storedFilePath,
      });
    });
    document.on('error', fail);
    document.pipe(output);

    try {
      document.rect(0, 0, document.page.width, 112).fill('#102a56');
      document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
        .text('DCRUST PLACEMENT PORTAL', 54, 35, { characterSpacing: 1.2 });
      document.fontSize(22).text('OFFER OF EMPLOYMENT', 54, 59, { width: 390 });
      if (offer.companyLogo?.startsWith('/uploads/logos/')) {
        const logoRoot = path.resolve(options.logoRoot || defaultLogoRoot);
        const logoPath = path.resolve(logoRoot, path.basename(offer.companyLogo));
        if (path.dirname(logoPath) === logoRoot && fs.existsSync(logoPath)) {
          try {
            document.image(logoPath, 465, 28, { fit: [70, 65], align: 'right', valign: 'center' });
          } catch (_) {
            // Optional company branding must not prevent offer generation.
          }
        }
      }
      document.fillColor('#1f2937').font('Helvetica').fontSize(10);
      document.moveDown(5);
      document.text(`Offer reference: ${offer.offerLetterNumber}`);
      document.text(`Issue date: ${new Date(offer.offerDate).toLocaleDateString('en-IN')}`);
      document.moveDown();
      document.font('Helvetica-Bold').fontSize(12).text(`Dear ${offer.studentName},`);
      document.moveDown(0.7);
      document.font('Helvetica').fontSize(10).text(
        `We are pleased to offer you the position of ${offer.designation} with ${offer.companyName}. This offer is subject to the terms set out below.`,
        { lineGap: 4 },
      );
      document.moveDown();
      document.font('Helvetica-Bold').fontSize(12).text('Offer details');
      document.moveDown(0.5);
      const details = [
        ['Candidate', offer.studentName],
        ['Registration number', offer.rollNumber || 'Not provided'],
        ['Company', offer.companyName],
        ['Position', offer.designation],
        ['Annual CTC', `${Number(offer.annualCtc).toLocaleString('en-IN')} INR`],
        ['Monthly stipend', `${Number(offer.monthlyStipend || 0).toLocaleString('en-IN')} INR`],
        ['Employment type', offer.employmentType],
        ['Work location', offer.jobLocation || 'To be confirmed'],
        ['Joining date', offer.joiningDate ? new Date(offer.joiningDate).toLocaleDateString('en-IN') : 'To be confirmed'],
        ['Reporting details', offer.reportingDetails || 'To be shared by the company'],
      ];
      details.forEach(([label, value], index) => {
        const y = document.y;
        if (index % 2 === 0) document.rect(54, y - 3, 487, 22).fill('#f1f5f9');
        document.fillColor('#475569').font('Helvetica-Bold').fontSize(9).text(label, 62, y + 3, { width: 145 });
        document.fillColor('#111827').font('Helvetica').text(String(value), 210, y + 3, { width: 320 });
        document.y = y + 23;
      });
      document.moveDown();
      document.font('Helvetica-Bold').fontSize(12).text('Terms and conditions');
      document.moveDown(0.5);
      document.font('Helvetica').fontSize(9).text(
        offer.termsAndConditions || 'This offer is subject to verification of the information provided and the company policies applicable at the time of joining.',
        { lineGap: 3 },
      );
      document.moveDown(2);
      document.text('Please confirm your decision through the DCRUST Placement Portal.');
      document.moveDown(2);
      document.font('Helvetica-Bold').text(offer.authorizedSignatory || 'Authorized Signatory');
      document.font('Helvetica').text(offer.companyName);
      document.moveDown(2);
      document.fillColor('#64748b').fontSize(8).text(
        [offer.companyName, offer.companyLocation, offer.companyContact].filter(Boolean).join(' · '),
        { align: 'center' },
      );
      document.end();
    } catch (error) {
      fail(error);
    }
  });
};

const removeOfferLetterPdf = (storedFileName, options = {}) => {
  if (!storedFilePattern.test(storedFileName || '')) return false;
  const offerRoot = options.offerRoot || defaultOfferRoot;
  const filePath = path.resolve(offerRoot, storedFileName);
  if (path.dirname(filePath) !== path.resolve(offerRoot) || !fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
};

const resolveOfferLetterPdfPath = (storedFileName, options = {}) => {
  if (!storedFilePattern.test(storedFileName || '')) return null;
  const offerRoot = options.offerRoot || defaultOfferRoot;
  const filePath = path.resolve(offerRoot, storedFileName);
  if (path.dirname(filePath) !== path.resolve(offerRoot) || !fs.existsSync(filePath)) return null;
  return filePath;
};

module.exports = {
  generateOfferLetterPdf,
  removeOfferLetterPdf,
  resolveOfferLetterPdfPath,
};

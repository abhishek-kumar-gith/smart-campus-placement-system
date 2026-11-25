// Runtime validation coverage for critical frontend routes and PDF interactions.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { transferProtectedPdf } from '../src/services/protectedPdf.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator,
});
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;

let server;
let root;
let container;
let RoleRoute;
let StatusBadge;
let OfferCenter;

before(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    plugins: [react()],
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });
  ({ default: RoleRoute } = await server.ssrLoadModule('/src/routes/RoleRoute.jsx'));
  ({ default: StatusBadge } = await server.ssrLoadModule('/src/components/common/StatusBadge.jsx'));
  ({ default: OfferCenter } = await server.ssrLoadModule('/src/components/OfferCenter.jsx'));
});

after(async () => {
  if (root) await act(async () => root.unmount());
  if (server) await server.close();
  dom.window.close();
});

async function render(element) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(element);
    await new Promise((resolve) => setImmediate(resolve));
  });
  return container;
}

test('unauthenticated dashboard route redirects to login', async () => {
  const tree = React.createElement(MemoryRouter, {
    initialEntries: ['/student/dashboard'],
    future: { v7_startTransition: true, v7_relativeSplatPath: true },
  },
    React.createElement(Routes, null,
      React.createElement(Route, {
        path: '/student/*',
        element: React.createElement(RoleRoute, { session: null, requiredRole: 'student' },
          React.createElement('h1', null, 'Student dashboard')),
      }),
      React.createElement(Route, { path: '/login', element: React.createElement('h1', null, 'Login page') }),
    ),
  );
  const page = await render(tree);
  assert.equal(page.querySelector('h1')?.textContent, 'Login page');
  await act(async () => root.unmount());
  root = null;
});

test('role routes admit the right student/admin and reject a recruiter on admin route', async () => {
  const renderRole = async (path, session, heading) => {
    const tree = React.createElement(MemoryRouter, {
      initialEntries: [path],
      future: { v7_startTransition: true, v7_relativeSplatPath: true },
    },
      React.createElement(Routes, null,
        React.createElement(Route, {
          path: '/student/*',
          element: React.createElement(RoleRoute, { session, requiredRole: 'student' },
            React.createElement('h1', null, 'Student dashboard')),
        }),
        React.createElement(Route, {
          path: '/recruiter/*',
          element: React.createElement(RoleRoute, { session, requiredRole: 'recruiter' },
            React.createElement('h1', null, 'Recruiter dashboard')),
        }),
        React.createElement(Route, {
          path: '/admin/*',
          element: React.createElement(RoleRoute, { session, requiredRole: 'admin' },
            React.createElement('h1', null, 'Admin dashboard')),
        }),
        React.createElement(Route, { path: '/', element: React.createElement('h1', null, 'Public portal') }),
      ),
    );
    const page = await render(tree);
    assert.equal(page.querySelector('h1')?.textContent, heading);
    await act(async () => root.unmount());
    root = null;
  };

  await renderRole('/student/dashboard', { user: { role: 'student' } }, 'Student dashboard');
  await renderRole('/recruiter/dashboard', { user: { role: 'recruiter' } }, 'Recruiter dashboard');
  await renderRole('/admin/dashboard', { user: { role: 'recruiter' } }, 'Public portal');
  await renderRole('/admin/dashboard', { user: { role: 'admin' } }, 'Admin dashboard');
});

test('status badge renders a readable status class', async () => {
  const page = await render(React.createElement(StatusBadge, { status: 'selected' }));
  const badge = page.querySelector('span');
  assert.equal(badge.textContent, 'selected');
  assert.ok(badge.classList.contains('badge-green'));
  await act(async () => root.unmount());
  root = null;
});

test('student offer center shows only student response actions and fetches the offer list', async () => {
  const api = {
    get: async () => ({
      data: { data: {
        records: [{
          _id: 'offer-1',
          studentId: { fullName: 'Test Student', rollNumber: 'R-1' },
          companyId: { name: 'Example Company' },
          designation: 'Engineer',
          annualCtc: 500000,
          status: 'issued',
          statusHistory: [],
          privatePdf: { originalFileName: 'offer-letter.pdf' },
        }],
        pagination: { page: 1, totalPages: 1 },
        summary: { total: 1, issued: 1 },
      } },
    }),
  };
  const page = await render(React.createElement(OfferCenter, { api, role: 'student' }));
  assert.match(page.textContent, /Test Student/);
  assert.ok([...page.querySelectorAll('button')].some((button) => button.textContent.includes('Accept')));
  assert.ok([...page.querySelectorAll('button')].some((button) => button.textContent.includes('Reject')));
  assert.doesNotMatch(page.textContent, /Generate offer letter/);
  await act(async () => root.unmount());
  root = null;
});

test('protected PDF viewing opens the popup before the authenticated API request', async () => {
  const order = [];
  const viewer = { opener: {}, location: { replace() {} }, closed: false, close() {} };
  const api = { get: async (url, options) => {
    order.push('request');
    assert.equal(url, '/applications/application-1/resume');
    assert.deepEqual(options, { responseType: 'blob' });
    return { data: new Blob(['%PDF-test']) };
  } };
  let releaseInterval;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalOpen = window.open;
  const originalInterval = window.setInterval;
  const originalClear = window.clearInterval;
  const revoked = [];
  URL.createObjectURL = () => 'blob:protected-pdf';
  URL.revokeObjectURL = (url) => revoked.push(url);
  window.open = () => {
    order.push('open');
    return viewer;
  };
  window.setInterval = (callback) => {
    releaseInterval = callback;
    return 17;
  };
  window.clearInterval = () => {};
  try {
    const transfer = transferProtectedPdf({
      api,
      endpoint: '/applications/application-1/resume',
      fileName: 'submitted-resume.pdf',
      download: false,
      onError: (message) => assert.fail(message),
      blockedMessage: 'blocked',
      failureMessage: 'failed',
    });
    assert.deepEqual(order, ['open', 'request']);
    assert.equal(await transfer, true);
    assert.equal(viewer.opener, null);
    viewer.closed = true;
    releaseInterval();
    assert.deepEqual(revoked, ['blob:protected-pdf']);
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    window.open = originalOpen;
    window.setInterval = originalInterval;
    window.clearInterval = originalClear;
  }
});

test('protected PDF download uses the supplied original name and separate authenticated endpoint', async () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = dom.window.HTMLAnchorElement.prototype.click;
  let downloadName;
  let revokeCallback;
  let requested;
  URL.createObjectURL = () => 'blob:download';
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function click() { downloadName = this.download; };
  try {
    const api = { get: async (url, options) => {
      requested = { url, options };
      return { data: new Blob(['%PDF-test']) };
    } };
    const originalTimeout = window.setTimeout;
    window.setTimeout = (callback) => { revokeCallback = callback; return 19; };
    try {
      assert.equal(await transferProtectedPdf({
        api,
        endpoint: '/applications/application-1/resume?download=true',
        fileName: 'submitted-resume.pdf',
        download: true,
        onError: (message) => assert.fail(message),
        blockedMessage: 'blocked',
        failureMessage: 'failed',
      }), true);
    } finally {
      window.setTimeout = originalTimeout;
    }
    assert.deepEqual(requested, {
      url: '/applications/application-1/resume?download=true',
      options: { responseType: 'blob' },
    });
    assert.equal(downloadName, 'submitted-resume.pdf');
    assert.equal(typeof revokeCallback, 'function');
    revokeCallback();
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    dom.window.HTMLAnchorElement.prototype.click = originalClick;
  }
});

test('protected PDF failures close the popup and report JSON error bodies', async () => {
  const originalOpen = window.open;
  const viewer = { opener: {}, location: { replace() {} }, closed: false, close() { this.closed = true; } };
  const errors = [];
  window.open = () => viewer;
  const errorBlob = new Blob([JSON.stringify({ message: 'Resume snapshot missing.' })]);
  try {
    const result = await transferProtectedPdf({
      api: { get: async () => { throw { response: { data: errorBlob } }; } },
      endpoint: '/applications/application-1/resume',
      fileName: 'submitted-resume.pdf',
      download: false,
      onError: (message) => errors.push(message),
      blockedMessage: 'blocked',
      failureMessage: 'failed',
    });
    assert.equal(result, false);
    assert.equal(viewer.closed, true);
    assert.deepEqual(errors, ['Resume snapshot missing.']);
  } finally {
    window.open = originalOpen;
  }
});

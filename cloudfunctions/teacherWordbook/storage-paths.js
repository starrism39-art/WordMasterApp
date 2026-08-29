'use strict';

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;
const SUPPORTED_EXTENSIONS = Object.freeze(['csv', 'xlsx']);

const assertSegment = (value, label) => {
  const segment = String(value === undefined || value === null ? '' : value).trim();
  if (!segment || !SAFE_SEGMENT.test(segment)) {
    throw new Error(`invalid_${label}`);
  }
  return segment;
};

const normalizeExtension = (value) => {
  const extension = String(value || '').trim().toLowerCase().replace(/^\./, '');
  return SUPPORTED_EXTENSIONS.includes(extension) ? extension : '';
};

const stagingRoot = ({ teacherId, wordbookId, uploadId }) => (
  `teacher-wordbooks/${assertSegment(teacherId, 'teacher_id')}`
  + `/${assertSegment(wordbookId, 'wordbook_id')}`
  + `/staging/${assertSegment(uploadId, 'upload_id')}`
);

const buildUploadPaths = ({ teacherId, wordbookId, uploadId, extension }) => {
  const safeExtension = normalizeExtension(extension);
  if (!safeExtension) throw new Error('invalid_extension');

  const root = stagingRoot({ teacherId, wordbookId, uploadId });
  return {
    root,
    source: `${root}/source.${safeExtension}`,
    validRows: `${root}/valid-rows.json`,
    errorReport: `${root}/error-report.json`
  };
};

const buildVersionPath = ({ teacherId, wordbookId, version }) => {
  const versionNumber = Number(version);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    throw new Error('invalid_version');
  }
  return `teacher-wordbooks/${assertSegment(teacherId, 'teacher_id')}`
    + `/${assertSegment(wordbookId, 'wordbook_id')}`
    + `/versions/v${versionNumber}/words.json`;
};

const fileIdMatchesPath = (fileId, cloudPath) => {
  const normalizedFileId = String(fileId || '').trim();
  const normalizedPath = String(cloudPath || '').replace(/^\/+/, '');
  if (!normalizedFileId || !normalizedPath) return false;
  return normalizedFileId === normalizedPath
    || normalizedFileId.endsWith(`/${normalizedPath}`);
};

module.exports = {
  SUPPORTED_EXTENSIONS,
  normalizeExtension,
  buildUploadPaths,
  buildVersionPath,
  fileIdMatchesPath
};

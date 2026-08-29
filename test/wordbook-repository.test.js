'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const officialSource = require('../data/wordbooks.js');
const TeacherWordbookAdapter = require('../utils/teacher-wordbook-adapter.js');
const WordbookRepository = require('../utils/wordbook-repository.js');

const rawOfficialBooks = ['primary', 'junior', 'senior'].flatMap((category) => (
  officialSource[category] || []
));

(async () => {
  const officialBooks = WordbookRepository.getOfficialWordbooks();
  assert.strictEqual(rawOfficialBooks.length, 46);
  assert.strictEqual(officialBooks.length, 46);
  assert.strictEqual(
    officialBooks.every((book) => book.sourceType === 'official'),
    true
  );
  assert.strictEqual(
    officialBooks.every((book) => book.canManage === false),
    true
  );

  rawOfficialBooks.forEach((rawBook, index) => {
    const adapted = officialBooks[index];
    assert.strictEqual(adapted.id, rawBook.id);
    assert.strictEqual(adapted.wordbookId, rawBook.id);
    assert.strictEqual(adapted.title, rawBook.title);
    assert.strictEqual(adapted.category, rawBook.category);
    assert.strictEqual(adapted.words, rawBook.words);
  });

  let emptyRequest = null;
  const emptyCatalog = await WordbookRepository.listWordbooks({
    callFunction: async (data) => {
      emptyRequest = data;
      return { result: { success: true, books: [] } };
    }
  });
  assert.deepStrictEqual(emptyRequest, { action: 'list' });
  assert.strictEqual(emptyCatalog.length, 46);
  assert.strictEqual(
    emptyCatalog.every((book) => book.sourceType === 'official'),
    true
  );

  const teacherAResponse = {
    wordbookId: 'teacher-a-book',
    title: 'Teacher A Book',
    category: 'junior',
    description: 'A catalog entry',
    sourceType: 'unexpected-client-value',
    status: 'active',
    version: 2,
    totalWords: 100,
    currentVersionId: 'teacher-a-book-v2',
    updatedAt: '2026-08-25T00:00:00.000Z'
  };
  let teacherARequest = null;
  const mixedCatalog = await WordbookRepository.listWordbooks({
    callFunction: async (data) => {
      teacherARequest = data;
      return { result: { success: true, books: [teacherAResponse] } };
    }
  });
  assert.deepStrictEqual(teacherARequest, { action: 'list' });
  assert.strictEqual(mixedCatalog.length, 47);
  assert.strictEqual(mixedCatalog.slice(0, 46).every((book) => (
    book.sourceType === 'official'
  )), true);
  assert.deepStrictEqual(mixedCatalog[46], {
    ...teacherAResponse,
    id: 'teacher-a-book',
    wordbookId: 'teacher-a-book',
    title: 'Teacher A Book',
    sourceType: 'teacher_custom',
    category: 'junior',
    description: 'A catalog entry',
    version: 2,
    totalWords: 100,
    status: 'active',
    canManage: true
  });

  const groups = WordbookRepository.groupWordbooks(mixedCatalog);
  assert.strictEqual(groups.officialWordbooks.length, 46);
  assert.strictEqual(groups.teacherWordbooks.length, 1);

  let forgedIdentityRequest = null;
  const teacherAOnly = await WordbookRepository.getTeacherWordbooks({
    teacherId: 'teacher-b',
    teacher_id: 'teacher-b',
    callFunction: async (data) => {
      forgedIdentityRequest = data;
      return { result: { success: true, books: [teacherAResponse] } };
    }
  });
  assert.deepStrictEqual(forgedIdentityRequest, { action: 'list' });
  assert.deepStrictEqual(
    teacherAOnly.map((book) => book.wordbookId),
    ['teacher-a-book']
  );

  const teacherBOnly = await TeacherWordbookAdapter.listTeacherWordbooks({
    callFunction: async (data) => {
      assert.deepStrictEqual(data, { action: 'list' });
      return {
        result: {
          success: true,
          books: [{
            wordbookId: 'teacher-b-book',
            title: 'Teacher B Book',
            status: 'draft'
          }]
        }
      };
    }
  });
  assert.deepStrictEqual(
    teacherBOnly.map((book) => book.wordbookId),
    []
  );

  const teacherBManagement = await WordbookRepository.listWordbooks({
    teacherScope: 'manage',
    callFunction: async (data) => {
      assert.deepStrictEqual(data, { action: 'list', scope: 'manage' });
      return {
        result: {
          success: true,
          books: [{
            wordbookId: 'teacher-b-draft',
            title: 'Teacher B Draft',
            status: 'draft',
            version: 0
          }]
        }
      };
    }
  });
  assert.strictEqual(teacherBManagement.length, 47);
  assert.deepStrictEqual(teacherBManagement[46], {
    wordbookId: 'teacher-b-draft',
    title: 'Teacher B Draft',
    status: 'draft',
    version: 0,
    id: 'teacher-b-draft',
    sourceType: 'teacher_custom',
    category: '',
    description: '',
    totalWords: 0,
    canManage: true
  });

  let disableRequest = null;
  const disabledResult = await WordbookRepository.disableTeacherWordbook(
    'teacher-a-book',
    {
      teacherId: 'forged-teacher',
      callFunction: async (data) => {
        disableRequest = data;
        return {
          result: {
            success: true,
            idempotent: false,
            book: {
              ...teacherAResponse,
              status: 'disabled'
            }
          }
        };
      }
    }
  );
  assert.deepStrictEqual(disableRequest, {
    action: 'disable',
    wordbookId: 'teacher-a-book'
  });
  assert.strictEqual(disabledResult.book.status, 'disabled');
  assert.strictEqual(disabledResult.book.sourceType, 'teacher_custom');
  assert.strictEqual(disabledResult.book.canManage, true);

  let capturedError = null;
  const fallbackCatalog = await WordbookRepository.listWordbooks({
    callFunction: async () => ({
      result: { success: false, error: 'INTERNAL_ERROR' }
    }),
    onTeacherError: (error) => {
      capturedError = error;
    }
  });
  assert.strictEqual(capturedError.code, 'INTERNAL_ERROR');
  assert.strictEqual(fallbackCatalog.length, 46);
  assert.strictEqual(
    fallbackCatalog.every((book) => book.sourceType === 'official'),
    true
  );

  const repositorySource = [
    '../utils/wordbook-repository.js',
    '../utils/teacher-wordbook-adapter.js'
  ].map((relativePath) => fs.readFileSync(
    path.resolve(__dirname, relativePath),
    'utf8'
  )).join('\n');
  assert.strictEqual(repositorySource.includes('cloud-wordbook-loader'), false);
  assert.strictEqual(/teacher(?:Id|_id)\s*:/.test(repositorySource), false);
  assert.strictEqual(/\.(?:add|set|update|remove|uploadFile)\s*\(/.test(repositorySource), false);

  const wordbookPageSource = fs.readFileSync(
    path.resolve(__dirname, '../subpages/wordbook/wordbook.js'),
    'utf8'
  );
  assert.strictEqual(
    wordbookPageSource.includes("teacherScope: this.data.selectMode ? 'active' : 'manage'"),
    true
  );

  console.log('wordbook-repository: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

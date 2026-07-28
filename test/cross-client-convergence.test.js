'use strict';

const assert = require('assert');
const {
  buildProgressMap,
  buildWordMasteryMap,
  mergeObjectAtWordLevel
} = require('../utils/cloud-migration.js');
const { reconcileLearningProgressMap } = require('../utils/learning-progress.js');
const { mergeById } = require('../utils/sync-merge.js');
const {
  calculateStudentCoreStats,
  calculateWordbookStats
} = require('../utils/stats-engine.js');

const teacherId = 'teacher-a';
const cloudMasteryDocs = [{
  _id: '456-senior-alpha',
  teacher_id: teacherId,
  student_id: 'student456',
  wordbook_id: 'senior_textbook_real',
  word_id: 'alpha',
  reviewCount: 0,
  updatedAt: 2000,
  mastered: true,
  difficult: false,
  antiForgettingSeed: false
}, {
  _id: '456-senior-beta-legacy',
  teacher_id: teacherId,
  student_id: 'student456',
  wordbook_id: 'senior_textbook_real',
  word_id: 'beta',
  reviewCount: 0,
  updatedAt: 1000,
  mastered: true,
  difficult: false
}, {
  _id: '456-senior-beta-scoped',
  teacher_id: teacherId,
  student_id: 'student456',
  wordbook_id: 'senior_textbook_real',
  word_id: 'beta',
  reviewCount: 1,
  lastReviewTime: 3000,
  updatedAt: 3000,
  mastered: false,
  difficult: true,
  antiForgettingSeed: true,
  antiForgettingSource: 'preview_not_mastered'
}, {
  _id: '456-reading-gamma',
  teacher_id: teacherId,
  student_id: 'student456',
  wordbook_id: 'gaokao_reading_words',
  word_id: 'gamma',
  reviewCount: 0,
  updatedAt: 2500,
  mastered: true,
  difficult: false
}, {
  _id: '456-renjiao-delta',
  teacher_id: teacherId,
  student_id: 'student456',
  wordbook_id: 'senior_book_1_ren_jiao',
  word_id: 'delta',
  reviewCount: 0,
  updatedAt: 2600,
  mastered: false,
  difficult: true,
  antiForgettingSeed: true,
  antiForgettingSource: 'preview_not_mastered'
}, {
  _id: 'cloud01-senior-epsilon',
  teacher_id: teacherId,
  student_id: 'student-cloud-01',
  wordbook_id: 'senior_textbook_real',
  word_id: 'epsilon',
  reviewCount: 0,
  updatedAt: 2700,
  mastered: false,
  difficult: true,
  antiForgettingSeed: true,
  antiForgettingSource: 'preview_not_mastered'
}];

const cloudProgressDocs = [{
  _id: '456-progress-legacy',
  teacher_id: teacherId,
  student_id: 'student456',
  learnedWords: 200,
  totalWords: 4209,
  updatedAt: 1000,
  wordbooks: {
    senior_textbook_real: {
      completedCount: 200,
      totalCount: 4209
    }
  }
}, {
  _id: '456-progress-scoped',
  teacher_id: teacherId,
  student_id: 'student456',
  learnedWords: 301,
  totalWords: 4292,
  updatedAt: 3000,
  wordbooks: {
    senior_textbook_real: {
      completedCount: 301,
      totalCount: 4292
    },
    gaokao_reading_words: {
      completedCount: 1,
      totalCount: 687
    },
    senior_book_1_ren_jiao: {
      completedCount: 1,
      totalCount: 365
    }
  }
}, {
  _id: 'cloud01-progress',
  teacher_id: teacherId,
  student_id: 'student-cloud-01',
  learnedWords: 1,
  totalWords: 4292,
  updatedAt: 2700,
  wordbooks: {
    senior_textbook_real: {
      completedCount: 1,
      totalCount: 4292
    }
  }
}];

const cloudLearningRecords = [{
  id: 'record-456-senior-1',
  studentId: 'student456',
  wordbookId: 'senior_textbook_real',
  studyDate: '2026-07-20T08:00:00+08:00',
  updatedAt: 2000
}, {
  id: 'record-456-senior-2',
  studentId: 'student456',
  wordbookId: 'senior_textbook_real',
  studyDate: '2026-07-21T08:00:00+08:00',
  updatedAt: 3000
}, {
  id: 'record-456-reading-1',
  studentId: 'student456',
  wordbookId: 'gaokao_reading_words',
  studyDate: '2026-07-21T09:00:00+08:00',
  updatedAt: 3000
}, {
  id: 'record-456-renjiao-1',
  studentId: 'student456',
  wordbookId: 'senior_book_1_ren_jiao',
  studyDate: '2026-07-22T09:00:00+08:00',
  updatedAt: 3000
}, {
  id: 'record-cloud01-senior-1',
  studentId: 'student-cloud-01',
  wordbookId: 'senior_textbook_real',
  studyDate: '2026-07-22T10:00:00+08:00',
  updatedAt: 3000
}];

const cloudMastery = buildWordMasteryMap(cloudMasteryDocs);
const cloudProgress = buildProgressMap(cloudProgressDocs);

const convergeClient = ({ localMastery, localProgress, localRecords }) => {
  const mastery = mergeObjectAtWordLevel(localMastery, cloudMastery);
  const records = mergeById(localRecords, cloudLearningRecords, 'id');
  const progress = reconcileLearningProgressMap(
    mergeObjectAtWordLevel(localProgress, cloudProgress),
    mastery,
    records
  );
  return { mastery, progress, records };
};

const clientA = convergeClient({
  localMastery: {
    student456: {
      senior_textbook_real: {
        alpha: {
          reviewCount: 0,
          updatedAt: 500,
          mastered: false,
          difficult: true
        }
      }
    }
  },
  localProgress: {
    student456: {
      learnedWords: 99,
      totalWords: 4209,
      wordbooks: {
        senior_textbook_real: {
          completedCount: 99,
          totalCount: 4209
        }
      }
    }
  },
  localRecords: [cloudLearningRecords[0]]
});

const clientB = convergeClient({
  localMastery: {
    'student-cloud-01': {
      senior_textbook_real: {
        epsilon: {
          reviewCount: 0,
          updatedAt: 600,
          mastered: true,
          difficult: false
        }
      }
    }
  },
  localProgress: {},
  localRecords: []
});

const pickState = (client, studentId, wordbookId, wordId) => {
  const record = client.mastery[studentId][wordbookId][wordId];
  return {
    reviewCount: record.reviewCount,
    mastered: record.mastered,
    difficult: record.difficult,
    antiForgettingSeed: record.antiForgettingSeed,
    antiForgettingSource: record.antiForgettingSource
  };
};

[
  ['student456', 'senior_textbook_real', 'alpha'],
  ['student456', 'senior_textbook_real', 'beta'],
  ['student456', 'gaokao_reading_words', 'gamma'],
  ['student456', 'senior_book_1_ren_jiao', 'delta'],
  ['student-cloud-01', 'senior_textbook_real', 'epsilon']
].forEach(([studentId, wordbookId, wordId]) => {
  assert.deepStrictEqual(
    pickState(clientA, studentId, wordbookId, wordId),
    pickState(clientB, studentId, wordbookId, wordId),
    `${studentId}/${wordbookId}/${wordId} must converge on both clients`
  );
});

assert.deepStrictEqual(clientA.progress, clientB.progress);
assert.deepStrictEqual(clientA.records, clientB.records);
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(
    clientA.mastery.student456.senior_textbook_real,
    'epsilon'
  ),
  false,
  'student data must not leak into another student'
);
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(
    clientA.mastery.student456.gaokao_reading_words,
    'delta'
  ),
  false,
  'word data must not leak into another wordbook'
);

const getStats = (client) => {
  const storage = {
    wordMastery: client.mastery,
    learningProgress: client.progress,
    learningRecords: client.records
  };
  global.wx = {
    getStorageSync: (key) => storage[key]
  };
  return {
    student456: calculateStudentCoreStats('student456'),
    cloud01: calculateStudentCoreStats('student-cloud-01'),
    senior: calculateWordbookStats('student456', 'senior_textbook_real'),
    reading: calculateWordbookStats('student456', 'gaokao_reading_words'),
    renjiao: calculateWordbookStats('student456', 'senior_book_1_ren_jiao')
  };
};

assert.deepStrictEqual(getStats(clientA), getStats(clientB));
assert.deepStrictEqual(getStats(clientA).student456, {
  masteredCount: 4,
  notMasteredCount: 2,
  checkinDays: 3
});
assert.deepStrictEqual(getStats(clientA).cloud01, {
  masteredCount: 1,
  notMasteredCount: 1,
  checkinDays: 1
});

console.log('cross-client-convergence: PASS');

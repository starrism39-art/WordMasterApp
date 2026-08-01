'use strict';

const assert = require('assert');

const storage = {
  wordMastery: {
    student456: {
      senior_textbook_real: {
        alpha: { mastered: true, difficult: false },
        beta: { mastered: false, difficult: true }
      },
      gaokao_reading_words: {
        gamma: { mastered: true, difficult: false }
      },
      preview_seed_book: {
        activePreviewSeed: {
          mastered: true,
          difficult: false,
          antiForgettingSeed: true,
          antiForgettingSource: 'preview_not_mastered',
          reviewCount: 1
        },
        activeLegacySeed: {
          mastered: true,
          difficult: false,
          antiForgettingSeed: true,
          reviewCount: 2
        },
        completedPreviewSeed: {
          mastered: true,
          difficult: false,
          antiForgettingSeed: false,
          antiForgettingSource: 'preview_not_mastered',
          reviewCount: 5
        },
        previewKnown: {
          mastered: true,
          difficult: false,
          antiForgettingSeed: false,
          antiForgettingSource: 'preview_mastered',
          reviewCount: 0
        }
      }
    },
    student789: {
      senior_textbook_real: {
        other: { mastered: false, difficult: true }
      }
    }
  },
  learningRecords: [
    { studentId: 'student456', wordbookId: 'senior_textbook_real', studyDate: '2026-07-20T08:00:00+08:00' },
    { student_id: 'student456', wordbook_id: 'senior_textbook_real', studyDate: '2026-07-21T08:00:00+08:00' },
    { studentId: 'student456', wordbookId: 'gaokao_reading_words', studyDate: '2026-07-22T08:00:00+08:00' },
    { studentId: 'student456', studyDate: '2026-07-23T08:00:00+08:00' },
    { studentId: 'student789', wordbookId: 'senior_textbook_real', studyDate: '2026-07-24T08:00:00+08:00' }
  ]
};

global.wx = {
  getStorageSync: (key) => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  removeStorageSync: (key) => { delete storage[key]; }
};

const {
  applyManualStatsOverride,
  calculateWordbookStats,
  getWordbookStats,
  saveStudentStats
} = require('../utils/stats-engine.js');

(async () => {
  assert.deepStrictEqual(
    calculateWordbookStats('student456', 'senior_textbook_real'),
    { masteredCount: 2, notMasteredCount: 1, checkinDays: 2 },
    '词书统计必须排除其他学生、其他词书和无法确认词书归属的旧记录'
  );

  assert.deepStrictEqual(
    calculateWordbookStats('student456', 'preview_seed_book'),
    { masteredCount: 4, notMasteredCount: 2, checkinDays: 0 },
    '五轮未完成的预习不会词和旧版抗遗忘种子必须继续计入未掌握，第五轮完成后退出'
  );

  assert.deepStrictEqual(
    applyManualStatsOverride(
      { masteredCount: 8, notMasteredCount: 4, checkinDays: 3 },
      {
        isManualOverride: true,
        manualMasteredCount: 10,
        manualNotMasteredCount: 7,
        manualCheckinDays: 5,
        baseMasteredCount: 9,
        baseNotMasteredCount: 5,
        baseCheckinDays: 4
      }
    ),
    { masteredCount: 9, notMasteredCount: 6, checkinDays: 4 },
    '有基准的管理员修正必须跟随真实数据增减，不能永久只增不减'
  );

  storage.wordbook_stats_student456_senior_textbook_real = {
    isManualOverride: true,
    manualMasteredCount: 10,
    manualNotMasteredCount: 4,
    manualCheckinDays: 5,
    baseMasteredCount: 3,
    baseNotMasteredCount: 2,
    baseCheckinDays: 2
  };
  assert.deepStrictEqual(
    getWordbookStats('student456', 'senior_textbook_real'),
    { masteredCount: 9, notMasteredCount: 3, checkinDays: 5 },
    '首页、统计页和词书页应共用同一个词书修正结果'
  );

  storage.stats_student456 = {
    masteredCount: 99,
    notMasteredCount: 88,
    checkinDays: 77,
    calculatedAt: 1,
    isManualOverride: false
  };
  const saved = await saveStudentStats('student456', {
    masteredCount: 2,
    notMasteredCount: 1,
    checkinDays: 2
  });
  assert.deepStrictEqual(
    {
      masteredCount: saved.masteredCount,
      notMasteredCount: saved.notMasteredCount,
      checkinDays: saved.checkinDays
    },
    { masteredCount: 2, notMasteredCount: 1, checkinDays: 2 },
    '普通派生缓存必须允许掌握状态和未掌握状态正常下降'
  );

  console.log('stats-consistency: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

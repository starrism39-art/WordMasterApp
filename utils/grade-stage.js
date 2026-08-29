'use strict';

const STAGE_CATEGORIES = Object.freeze({
  '小学': 'primary',
  '初中': 'junior',
  '高中': 'senior',
  '大学': 'college'
});

const normalizeGradeText = (grade) => (
  String(grade === undefined || grade === null ? '' : grade)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
);

const resolveNumericGrade = (gradeText) => {
  const matches = [
    gradeText.match(/^(\d{1,2})(?:年级|级)?$/),
    gradeText.match(/^grade(\d{1,2})$/),
    gradeText.match(/^(\d{1,2})(?:st|nd|rd|th)$/)
  ];
  const match = matches.find(Boolean);
  if (!match) return null;

  const gradeNumber = Number(match[1]);
  if (gradeNumber >= 1 && gradeNumber <= 6) return '小学';
  if (gradeNumber >= 7 && gradeNumber <= 9) return '初中';
  if (gradeNumber >= 10 && gradeNumber <= 12) return '高中';
  return null;
};

const resolveGradeStage = (grade) => {
  const gradeText = normalizeGradeText(grade);
  if (!gradeText) return null;

  if (/(大学|本科|专科|大[一二三四五]|college|university|undergraduate)/.test(gradeText)) {
    return '大学';
  }
  if (/(高中|高[一二三]|十年级|十一年级|十二年级|senior|highschool)/.test(gradeText)) {
    return '高中';
  }
  if (/(初中|初[一二三]|七年级|八年级|九年级|junior|middleschool)/.test(gradeText)) {
    return '初中';
  }
  if (/(小学|一年级|二年级|三年级|四年级|五年级|六年级|primary|elementary)/.test(gradeText)) {
    return '小学';
  }

  return resolveNumericGrade(gradeText);
};

const getCategoryForStage = (stage) => STAGE_CATEGORIES[stage] || '';

module.exports = {
  STAGE_CATEGORIES,
  getCategoryForStage,
  normalizeGradeText,
  resolveGradeStage
};

'use strict';

const coreScenarios = [
  scenario('首页', '/pages/index/index', true),
  scenario('学生管理', '/pages/students/students', true),
  scenario('学习页', '/pages/learning/learning'),
  scenario('复习页', '/pages/review/review'),
  scenario('词书选择', '/subpages/wordbook/wordbook'),
  scenario('学习统计', '/subpages/stats/stats'),
  scenario('学习记录', '/subpages/records/records')
];

const extendedScenarios = [
  scenario('添加学生', '/subpages/add-student/add-student'),
  scenario('学生列表', '/subpages/student-list/student-list'),
  scenario('合并复习', '/subpages/review-merged/review-merged'),
  scenario('单词详情', '/subpages/word-view/word-view'),
  scenario('网格复习', '/subpages/grid-review/grid-review'),
  scenario('数据备份', '/subpages/data-backup/data-backup'),
  scenario('数据修复', '/subpages/data-repair/data-repair')
];

module.exports = {
  defaultProfile: 'full',
  settleMs: 1000,
  profiles: {
    core: coreScenarios,
    full: coreScenarios.concat(extendedScenarios)
  }
};

function scenario(name, route, tabPage) {
  return {
    name,
    route,
    navigation: tabPage ? ['switchTab', 'reLaunch'] : ['reLaunch'],
    selectors: ['.container'],
    minimumElements: 1
  };
}

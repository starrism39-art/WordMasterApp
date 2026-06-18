/**
 * 数据版本管理与迁移工具
 * 支持小程序升级时的数据备份和格式迁移
 */

// 当前数据版本号
const CURRENT_DATA_VERSION = '1.0.0';

/**
 * 初始化数据版本
 * 如果是首次运行或版本不匹配，则进行备份和迁移
 */
function initializeDataVersion() {
  try {
    const storedVersion = wx.getStorageSync('dataVersion');
    console.log('当前存储的数据版本:', storedVersion, '程序版本:', CURRENT_DATA_VERSION);
    
    if (!storedVersion) {
      // 首次运行，直接设置版本号
      console.log('首次运行，初始化数据版本为 ' + CURRENT_DATA_VERSION);
      wx.setStorageSync('dataVersion', CURRENT_DATA_VERSION);
      return { isFirstRun: true, version: CURRENT_DATA_VERSION };
    }
    
    if (storedVersion !== CURRENT_DATA_VERSION) {
      // 版本不匹配，需要备份和迁移
      console.log('检测到版本升级:', storedVersion, '->', CURRENT_DATA_VERSION);
      backupDataByVersion(storedVersion);
      migrateDataIfNeeded(storedVersion, CURRENT_DATA_VERSION);
      wx.setStorageSync('dataVersion', CURRENT_DATA_VERSION);
      return { isFirstRun: false, upgraded: true, oldVersion: storedVersion, newVersion: CURRENT_DATA_VERSION };
    }
    
    return { isFirstRun: false, upgraded: false, version: CURRENT_DATA_VERSION };
  } catch (error) {
    console.error('初始化数据版本失败:', error);
    return { error: true, message: error.message };
  }
}

/**
 * 备份指定版本的所有数据
 * @param {string} version 要备份的版本号
 */
function backupDataByVersion(version) {
  try {
    const dataKeys = [
      'students',
      'learningRecords',
      'learningProgress',
      'wordMastery',
      'currentStudent'
    ];
    
    // 获取所有预习状态键（动态的）
    const info = wx.getStorageSync('info');
    if (info && info.keys) {
      dataKeys.push(...info.keys.filter(k => k.startsWith('previewMastery_')));
    } else {
      // 扫描存储中的所有键来找预习状态
      const allKeys = getAllStorageKeys();
      const previewMasteryKeys = allKeys.filter(k => k.startsWith('previewMastery_'));
      dataKeys.push(...previewMasteryKeys);
    }
    
    const backupData = {};
    const backupKey = `dataBackup_v${version}`;
    
    dataKeys.forEach(key => {
      try {
        const data = wx.getStorageSync(key);
        if (data !== undefined && data !== null) {
          backupData[key] = data;
        }
      } catch (e) {
        console.warn(`备份 ${key} 失败:`, e);
      }
    });
    
    // 保存备份
    wx.setStorageSync(backupKey, backupData);
    
    // 记录备份元数据
    const backupInfo = {
      version: version,
      timestamp: new Date().toISOString(),
      dataCount: Object.keys(backupData).length
    };
    wx.setStorageSync(`${backupKey}_info`, backupInfo);
    
    console.log(`已备份版本 ${version} 的数据到 ${backupKey}，共 ${Object.keys(backupData).length} 项`);
    return backupKey;
  } catch (error) {
    console.error('备份数据失败:', error);
    throw error;
  }
}

/**
 * 获取所有存储的键（仅适用支持的微信版本）
 */
function getAllStorageKeys() {
  try {
    const storageInfo = wx.getStorageInfoSync();
    return Array.isArray(storageInfo.keys) ? storageInfo.keys : [];
  } catch (e) {
    console.warn('无法获取所有存储键，使用已知键列表');
    return [];
  }
}

/**
 * 数据迁移逻辑
 * 根据版本号进行必要的数据格式转换
 * @param {string} fromVersion 从哪个版本
 * @param {string} toVersion 迁移到哪个版本
 */
function migrateDataIfNeeded(fromVersion, toVersion) {
  try {
    console.log(`执行数据迁移: ${fromVersion} -> ${toVersion}`);
    
    // 版本号比较（简单的字符串比较对于 x.y.z 格式可能不准）
    const fromVersionParts = parseVersion(fromVersion);
    const toVersionParts = parseVersion(toVersion);
    
    // 例如：从 0.9.x 升级到 1.0.0
    if (isVersionLess(fromVersionParts, toVersionParts)) {
      // 执行迁移逻辑
      performDataMigration(fromVersion, toVersion);
    }
  } catch (error) {
    console.error('数据迁移失败:', error);
  }
}

/**
 * 执行具体的数据迁移操作
 */
function performDataMigration(fromVersion, toVersion) {
  try {
    // 修复 wordMastery 结构问题
    repairWordMasteryStructure();
    
    // 修复 learningRecords 中的日期格式
    repairLearningRecordsDates();
    
    // 修复 previewMastery 中可能的格式问题
    repairPreviewMasteryData();
    
    // 验证迁移后的数据完整性
    validateMigratedData();
    
    console.log(`数据迁移完成: ${fromVersion} -> ${toVersion}`);
  } catch (error) {
    console.error('执行数据迁移时出错:', error);
    throw error;
  }
}

/**
 * 修复 wordMastery 的结构问题
 */
function repairWordMasteryStructure() {
  try {
    let wordMastery = wx.getStorageSync('wordMastery') || {};
    let hasChanges = false;
    
    // 确保是对象格式
    if (typeof wordMastery !== 'object' || Array.isArray(wordMastery)) {
      wordMastery = {};
      hasChanges = true;
    }
    
    // 检查嵌套结构
    for (const studentId in wordMastery) {
      const student = wordMastery[studentId];
      
      // 如果不是对象，则重置
      if (typeof student !== 'object' || Array.isArray(student)) {
        wordMastery[studentId] = {};
        hasChanges = true;
        continue;
      }
      
      for (const wordbookId in student) {
        const wordbook = student[wordbookId];
        
        if (Array.isArray(wordbook)) {
          // 将旧数组格式升级为新对象格式（与 migrateAntiForgettingSeedIfNeeded 一致）
          const upgraded = {};
          const now = Date.now();
          wordbook.forEach((wordId) => {
            if (!wordId) return;
            upgraded[String(wordId)] = {
              mastered: false,
              difficult: false,
              reviewCount: 0,
              firstMasteryTime: now,
              lastReviewTime: now,
              nextReviewTime: now,
              antiForgettingSeed: true,
              reviewTimeline: []
            };
          });
          wordMastery[studentId][wordbookId] = upgraded;
          hasChanges = true;
        } else if (typeof wordbook !== 'object') {
          wordMastery[studentId][wordbookId] = {};
          hasChanges = true;
        }
      }
    }
    
    if (hasChanges) {
      wx.setStorageSync('wordMastery', wordMastery);
      console.log('已修复 wordMastery 结构');
    }
  } catch (error) {
    console.error('修复 wordMastery 失败:', error);
  }
}

/**
 * 修复 learningRecords 中的日期格式
 */
function repairLearningRecordsDates() {
  try {
    let records = wx.getStorageSync('learningRecords') || [];
    let hasChanges = false;
    
    if (!Array.isArray(records)) {
      records = [];
      hasChanges = true;
    } else {
      records.forEach(record => {
        // 确保 date 字段存在且格式正确
        if (!record.date) {
          record.date = new Date().toISOString().split('T')[0];
          hasChanges = true;
        } else if (typeof record.date === 'number') {
          // 转换时间戳为日期字符串
          record.date = new Date(record.date).toISOString().split('T')[0];
          hasChanges = true;
        }
      });
    }
    
    if (hasChanges) {
      wx.setStorageSync('learningRecords', records);
      console.log('已修复 learningRecords 日期格式');
    }
  } catch (error) {
    console.error('修复 learningRecords 日期失败:', error);
  }
}

/**
 * 修复 previewMastery 数据
 */
function repairPreviewMasteryData() {
  try {
    // 扫描所有 previewMastery_* 键
    const students = wx.getStorageSync('students') || [];
    
    students.forEach(student => {
      const studentId = student.id;
      const books = student.wordbooks || [];
      
      books.forEach(book => {
        const wordbookId = book.id;
        const key = `previewMastery_${studentId}_${wordbookId}`;
        
        let mastery = wx.getStorageSync(key) || {};
        
        // 确保是对象
        if (typeof mastery !== 'object' || Array.isArray(mastery)) {
          mastery = {};
          wx.setStorageSync(key, mastery);
          console.log(`已重置 ${key} 为空对象`);
        }
      });
    });
  } catch (error) {
    console.error('修复 previewMastery 数据失败:', error);
  }
}

/**
 * 验证迁移后的数据完整性
 */
function validateMigratedData() {
  try {
    const stats = {
      students: 0,
      learningRecords: 0,
      wordMastery: 0,
      previewMasteryKeys: 0
    };
    
    const students = wx.getStorageSync('students') || [];
    stats.students = Array.isArray(students) ? students.length : 0;
    
    const records = wx.getStorageSync('learningRecords') || [];
    stats.learningRecords = Array.isArray(records) ? records.length : 0;
    
    const mastery = wx.getStorageSync('wordMastery') || {};
    stats.wordMastery = Object.keys(mastery).length;
    
    // 计算 previewMastery 键数（可选）
    // stats.previewMasteryKeys = countPreviewMasteryKeys();
    
    console.log('迁移后数据验证:', stats);
    return stats;
  } catch (error) {
    console.error('验证迁移数据失败:', error);
    return null;
  }
}

/**
 * 版本号解析 "1.2.3" -> [1, 2, 3]
 */
function parseVersion(versionStr) {
  return versionStr.split('.').map(v => parseInt(v, 10) || 0);
}

/**
 * 比较版本号是否小于
 */
function isVersionLess(version1, version2) {
  for (let i = 0; i < Math.max(version1.length, version2.length); i++) {
    const v1 = version1[i] || 0;
    const v2 = version2[i] || 0;
    if (v1 < v2) return true;
    if (v1 > v2) return false;
  }
  return false;
}

/**
 * 恢复指定版本的备份数据
 * @param {string} version 要恢复的版本号
 * @param {boolean} overwrite 是否覆盖现有数据
 */
function restoreBackup(version, overwrite = false) {
  try {
    const backupKey = `dataBackup_v${version}`;
    const backupData = wx.getStorageSync(backupKey);
    
    if (!backupData) {
      console.warn(`找不到版本 ${version} 的备份数据`);
      return false;
    }

    // 无论 overwrite 与否，都走安全合并（只追加，不删除现有数据）
    // overwrite=true 时允许覆盖同 ID 的已有条目，但不删除备份中没有的数据
    const { safeMergeRestore } = require('./safe-merge-restore.js');
    const mergeResult = safeMergeRestore(backupData);

    // 单值字段：仅本地为空时恢复
    const singleKeys = ['selectedStudent', 'selectedWordbook', 'currentStudent', 'currentWordbook', 'dataVersion'];
    singleKeys.forEach(function(key) {
      if (backupData[key] !== undefined && !wx.getStorageSync(key)) {
        wx.setStorageSync(key, backupData[key]);
      }
    });
    
    console.log('已恢复版本 ' + version + ' 的备份数据，新增:', (mergeResult.summary && mergeResult.summary.totalAdded) || 0);
    return true;
  } catch (error) {
    console.error('恢复备份失败:', error);
    return false;
  }
}

/**
 * 获取所有可用的备份版本
 */
function getAvailableBackups() {
  try {
    const storageKeys = getAllStorageKeys();
    const backupKeys = storageKeys.filter(key => /^dataBackup_v.+$/.test(key) && !/_info$/.test(key));

    const backups = backupKeys.map(backupKey => {
      const version = backupKey.replace(/^dataBackup_v/, '');
      const info = wx.getStorageSync(`${backupKey}_info`) || {};
      const backupData = wx.getStorageSync(backupKey) || {};

      return {
        version,
        backupKey,
        infoKey: `${backupKey}_info`,
        timestamp: info.timestamp || null,
        dataCount: typeof info.dataCount === 'number' ? info.dataCount : Object.keys(backupData).length,
        availableKeys: Object.keys(backupData),
        hasLearningRecords: Object.prototype.hasOwnProperty.call(backupData, 'learningRecords'),
        hasWordMastery: Object.prototype.hasOwnProperty.call(backupData, 'wordMastery'),
        hasStudents: Object.prototype.hasOwnProperty.call(backupData, 'students')
      };
    });

    backups.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });

    return backups;
  } catch (error) {
    console.error('获取备份列表失败:', error);
    return [];
  }
}

/**
 * 导出所有数据为 JSON（用于备份/调试）
 */
function exportAllData() {
  try {
    const dataKeys = [
      'students',
      'learningRecords',
      'learningProgress',
      'wordMastery',
      'currentStudent',
      'dataVersion'
    ];
    
    const exportData = {
      exportTime: new Date().toISOString(),
      version: wx.getStorageSync('dataVersion'),
      data: {}
    };
    
    dataKeys.forEach(key => {
      const value = wx.getStorageSync(key);
      if (value !== undefined) {
        exportData.data[key] = value;
      }
    });
    
    // 扫描预习状态
    const students = wx.getStorageSync('students') || [];
    students.forEach(student => {
      const books = student.wordbooks || [];
      books.forEach(book => {
        const key = `previewMastery_${student.id}_${book.id}`;
        const value = wx.getStorageSync(key);
        if (value) {
          exportData.data[key] = value;
        }
      });
    });
    
    return exportData;
  } catch (error) {
    console.error('导出数据失败:', error);
    return null;
  }
}

/**
 * 清理旧备份数据（保留最近N个版本）
 * @param {number} keepVersions 保留的版本数
 */
function cleanupOldBackups(keepVersions = 3) {
  try {
    // 这需要知道所有的备份版本
    // 实际实现需要追踪备份版本的历史
    console.log(`清理旧备份，保留最近 ${keepVersions} 个版本`);
  } catch (error) {
    console.error('清理备份失败:', error);
  }
}

module.exports = {
  CURRENT_DATA_VERSION,
  initializeDataVersion,
  backupDataByVersion,
  migrateDataIfNeeded,
  restoreBackup,
  getAvailableBackups,
  exportAllData,
  cleanupOldBackups
};

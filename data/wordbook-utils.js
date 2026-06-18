// 词书数据工具函数

function sanitizeWordText(word) {
  if (typeof word !== 'string') return word;
  let cleaned = word;

  // ★ 只去除词形变化括号，保留短语搭配括号
  // 短语搭配特征：括号内包含"空格+字母"模式（如 for sth），或斜杠（如 from sb/sth）
  // 词形变化特征：括号内仅有缩写、逗号分隔的变体、纯符号等
  cleaned = cleaned.replace(/\(([^()]*)\)/g, function(match, inner) {
    // 括号内含斜杠 → 短语搭配如 (from sb/sth)，保留
    if (/\//.test(inner)) return match;
    // 括号内包含 "空格后紧跟字母" → 短语搭配如 (for sth)，保留
    // 但要排除 ", said" 这种逗号后的情况：检查空格前是否是逗号
    if (/\s[a-zA-Z]/.test(inner) && !/,\s*[a-zA-Z]/.test(inner)) return match;
    // 纯词形变化，去除
    return '';
  });
  // 同样处理中文括号
  cleaned = cleaned.replace(/（([^（）]*)）/g, function(match, inner) {
    if (/\//.test(inner)) return match;
    if (/\s[a-zA-Z]/.test(inner) && !/,\s*[a-zA-Z]/.test(inner)) return match;
    return '';
  });
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned || word;
}

// 合并多个词书数据文件
function mergeWordbooks() {
  try {
    // 加载不同级别的词书数据
    const primaryWords = require('./primary_real_words.js') || [];
    const seniorWords = require('./senior_real_words.js') || [];
    const juniorExamWords = require('./初中中考词汇.js') || [];
    const newCurriculumSeniorWords = require('./new_curriculum_senior_words.js') || [];
    const gaokaoReadingWords = require('./高考英语阅读高频词汇.js') || [];
    
    // 加载冀教版词书数据
    let ji7thWords = [];
    let ji8thFirstWords = [];
    let ji8thSecondWords = [];
    let ji9thWords = [];
    
    try {
      ji7thWords = require('./ji_7th_grade_second_complete.js') || [];
      ji8thFirstWords = require('./ji_8th_grade_first_complete.js') || [];
      ji8thSecondWords = require('./ji_8th_grade_second_complete.js') || [];
      ji9thWords = require('./ji_9th_grade_complete.js') || [];
    } catch (e) {
      console.warn('加载冀教版词书数据失败:', e);
    }
    
    // 加载译林牛津版词书数据
    let yiLin7thFirstWords = [];
    let yiLin7thSecondWords = [];
    let yiLin8thFirstWords = [];
    let yiLin8thSecondWords = [];
    let yiLin9thFirstWords = [];
    
    try {
      yiLin7thFirstWords = require('./yi_lin_7th_grade_first.js') || [];
      yiLin7thSecondWords = require('./yi_lin_7th_grade_second.js') || [];
      yiLin8thFirstWords = require('./yi_lin_8th_grade_first.js') || [];
      yiLin8thSecondWords = require('./yi_lin_8th_grade_second.js') || [];
      yiLin9thFirstWords = require('./yi_lin_9th_grade_first.js') || [];
    } catch (e) {
      console.warn('加载译林牛津版词书数据失败:', e);
    }
    
    // 加载外研社（新标准）词书数据
    let newStandard7thSecondWords = [];
    let newStandard8thSecondWords = [];
    let newStandard9thFirstWords = [];
    let newStandard9thSecondWords = [];
    
    try {
      newStandard7thSecondWords = require('./new_standard_7th_grade_second_complete.js') || [];
      newStandard8thSecondWords = require('./new_standard_8th_grade_second_complete.js') || [];
      newStandard9thFirstWords = require('./new_standard_9th_grade_first_complete.js') || [];
      newStandard9thSecondWords = require('./new_standard_9th_grade_second_complete.js') || [];
    } catch (e) {
      console.warn('加载外研社词书数据失败:', e);
    }
    
    // 加载人教版词书数据
    let renJiao7thFirstWords = [];
    let renJiao7thSecondWords = [];
    let renJiao8thFirstWords = [];
    let renJiao8thSecondWords = [];
    let renJiao9thWords = [];
    let renJiaoSenior1Words = [];
    let renJiaoSenior2Words = [];
    
    try {
      renJiao7thFirstWords = require('./ren_jiao_7th_grade_first.js') || [];
      renJiao7thSecondWords = require('./ren_jiao_7th_grade_second.js') || [];
      renJiao8thFirstWords = require('./ren_jiao_8th_grade_first.js') || [];
      renJiao8thSecondWords = require('./ren_jiao_8th_grade_second.js') || [];
      renJiao9thWords = require('./ren_jiao_9th_grade.js') || [];
      renJiaoSenior1Words = require('./ren_jiao_senior_book_1.js') || [];
      renJiaoSenior2Words = require('./ren_jiao_senior_book_2.js') || [];
    } catch (e) {
      console.warn('加载人教版词书数据失败:', e);
    }
    
    // 合并所有单词数据
    const mergedWords = [
      ...primaryWords,
      ...seniorWords,
      ...juniorExamWords,
      ...newCurriculumSeniorWords,
      ...gaokaoReadingWords,
      ...ji7thWords,
      ...ji8thFirstWords,
      ...ji8thSecondWords,
      ...ji9thWords,
      ...yiLin7thFirstWords,
      ...yiLin7thSecondWords,
      ...yiLin8thFirstWords,
      ...yiLin8thSecondWords,
      ...yiLin9thFirstWords,
      ...newStandard7thSecondWords,
      ...newStandard8thSecondWords,
      ...newStandard9thFirstWords,
      ...newStandard9thSecondWords,
      ...renJiao7thFirstWords,
      ...renJiao7thSecondWords,
      ...renJiao8thFirstWords,
      ...renJiao8thSecondWords,
      ...renJiao9thWords,
      ...renJiaoSenior1Words,
      ...renJiaoSenior2Words
    ].map((item) => {
      if (!item || typeof item !== 'object') return item;
      const fixedWord = sanitizeWordText(item.word);
      if (fixedWord === item.word) return item;
      return {
        ...item,
        word: fixedWord
      };
    });
    
    console.log('合并后的单词总数:', mergedWords.length);
    
    return mergedWords;
  } catch (error) {
    console.error('合并词书数据失败:', error);
    return [];
  }
}

// 创建单词映射表，提高查找效率
function createWordMap(words) {
  const wordMap = {};
  
  words.forEach(word => {
    if (word && word.word) {
      const fixedWord = sanitizeWordText(word.word);
      const wordKey = fixedWord.toLowerCase();
      // 只保留第一个出现的单词，避免重复
      if (!wordMap[wordKey]) {
        wordMap[wordKey] = fixedWord === word.word
          ? word
          : {
              ...word,
              word: fixedWord
            };
      }
    }
  });
  
  console.log('创建的单词映射表大小:', Object.keys(wordMap).length);
  
  return wordMap;
}

// 查找单词：支持大小写不敏感与安全兜底，不做高风险的全量包含匹配
function findWord(word, wordMap) {
  if (!word || !wordMap) {
    return null;
  }

  const normalize = (text) => String(text || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const wordKey = normalize(word);

  // 常见英美拼写映射
  const aliasMap = {
    'kilometre': 'kilometer',
    'kilometres': 'kilometers',
    'metre': 'meter',
    'metres': 'meters',
    'centre': 'center',
    'centres': 'centers',
    'theatre': 'theater',
    'theatres': 'theaters',
    'colour': 'color',
    'colours': 'colors',
    'favourite': 'favorite',
    'favourites': 'favorites',
    'labour': 'labor',
    'travelling': 'traveling',
    'practise': 'practice'
  };

  const candidateKeys = [wordKey];
  if (aliasMap[wordKey]) {
    candidateKeys.push(aliasMap[wordKey]);
  }
  
  // 精确匹配
  for (const key of candidateKeys) {
    if (wordMap[key]) {
      return wordMap[key];
    }
  }
  
  // 尝试查找短语中的核心单词
  const words = wordKey.split(/\s+/);
  if (words.length > 1) {
    // 尝试查找第一个单词
    const firstWordKey = normalize(words[0]);
    if (wordMap[firstWordKey]) {
      return wordMap[firstWordKey];
    }
    
    // 尝试查找最后一个单词
    const lastWordKey = normalize(words[words.length - 1]);
    if (wordMap[lastWordKey]) {
      return wordMap[lastWordKey];
    }
  }
  
  // 安全兜底：仅允许长度>=4的前后缀匹配，避免 i/a/ms 等短词误命中
  const safeCandidates = candidateKeys.filter(k => k && k.length >= 4);
  for (const candidate of safeCandidates) {
    const candidateWithSpace = ` ${candidate} `;
    for (const key in wordMap) {
      const normalizedKey = normalize(key);
      if (!normalizedKey || normalizedKey.length < 4) {
        continue;
      }

      const keyWithSpace = ` ${normalizedKey} `;
      if (keyWithSpace.includes(candidateWithSpace) || candidateWithSpace.includes(keyWithSpace)) {
        return wordMap[key];
      }
    }
  }
  
  return null;
}

// ★ P0: 短语词典查词 — 单字原样返回，短语查 wordMap 获取正确文本
function lookUpPhrase(wordText, wordMap) {
  if (!wordText || typeof wordText !== 'string') return wordText;
  const trimmed = wordText.trim();
  if (!trimmed) return wordText;

  // 不含空格 → 单字，原样返回，不走词典
  if (!trimmed.includes(' ')) return wordText;

  // 短语 → 查词典
  const key = trimmed.toLowerCase();
  if (wordMap && wordMap[key]) {
    return wordMap[key].word || trimmed;
  }

  // 词典未命中 → 也返回原文，不做任何截断
  return trimmed;
}

// 导出工具函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mergeWordbooks,
    createWordMap,
    findWord,
    lookUpPhrase
  };
}

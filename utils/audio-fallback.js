// 音频URL兜底解析：主源播放失败后，尝试从 dictionaryapi 获取可播放音频

const fallbackCache = {};

function normalizePronunciationWord(word) {
  if (!word || typeof word !== 'string') return '';

  let normalized = word.trim();
  if (!normalized) return '';

  // 移除常见词形说明，例如 (pl. pence)、（复数）等
  normalized = normalized.replace(/\([^)]*\)/g, ' ');
  normalized = normalized.replace(/（[^）]*）/g, ' ');

  // ★ 仅保留英文字母、空格、连字符、撇号（排除句点等标点，防止URL解析异常）
  normalized = normalized.replace(/[^A-Za-z\s\-']/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  // 对 Mr/Mrs/Ms 等形式做温和归一化
  normalized = normalized.replace(/'/g, '');
  normalized = normalized.trim();
  if (!normalized) return '';

  // dictionaryapi 对多词短语支持有限，兜底时优先首个英文词
  const firstToken = normalized.split(/\s+/)[0] || '';
  return firstToken.toLowerCase();
}

// ★ P0: 有道TTS支持多词短语，保留完整短语以获取正确发音
function normalizeYoudaoQueryWord(word) {
  if (!word || typeof word !== 'string') return '';

  let normalized = word.trim();
  if (!normalized) return '';

  // ★ 斜杠替换为空格，避免有道API 500错误（如 the North/South Pole）
  normalized = normalized.replace(/\//g, ' ');

  // 移除常见词形说明，例如 (pl. pence)、（复数）等
  normalized = normalized.replace(/\([^)]*\)/g, ' ');
  normalized = normalized.replace(/（[^）]*）/g, ' ');

  // ★ 保留英文字母、空格、连字符、撇号
  normalized = normalized.replace(/[^A-Za-z\s\-']/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  // 温和归一化
  normalized = normalized.replace(/'/g, '');
  normalized = normalized.trim();
  if (!normalized) return '';

  // ★ 保留完整短语（最多6个词），超过则截断以避免TTS超时
  const tokens = normalized.split(/\s+/);
  if (tokens.length > 6) {
    normalized = tokens.slice(0, 6).join(' ');
  }
  return normalized.toLowerCase();
}

function buildYoudaoAudioUrl(word) {
  const queryWord = normalizeYoudaoQueryWord(word);
  if (!queryWord) return null;
  return `https://dict.youdao.com/dictvoice?type=0&audio=${encodeURIComponent(queryWord)}`;
}

function normalizeAudioUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith('https://')) {
    // 仅接受常见音频扩展名，避免拿到不可解码的资源
    if (!/\.(mp3|m4a|wav|ogg)(\?|$)/i.test(trimmed)) {
      return null;
    }
    return trimmed;
  }

  return null;
}

function extractAudioUrl(payload) {
  if (!Array.isArray(payload)) return null;

  for (let i = 0; i < payload.length; i++) {
    const entry = payload[i];
    if (!entry || !Array.isArray(entry.phonetics)) continue;

    for (let j = 0; j < entry.phonetics.length; j++) {
      const phonetic = entry.phonetics[j];
      const normalized = normalizeAudioUrl(phonetic && phonetic.audio);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function resolveDictionaryApiAudioUrl(word) {
  return new Promise((resolve) => {
    const key = normalizePronunciationWord(word);
    if (!key) {
      resolve(null);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(fallbackCache, key)) {
      resolve(fallbackCache[key]);
      return;
    }

    const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`;
    wx.request({
      url: apiUrl,
      method: 'GET',
      success: (res) => {
        const fallbackUrl = extractAudioUrl(res && res.data);
        fallbackCache[key] = fallbackUrl || null;
        resolve(fallbackUrl || null);
      },
      fail: () => {
        fallbackCache[key] = null;
        resolve(null);
      }
    });
  });
}

module.exports = {
  resolveDictionaryApiAudioUrl,
  normalizePronunciationWord,
  normalizeYoudaoQueryWord,
  buildYoudaoAudioUrl
};

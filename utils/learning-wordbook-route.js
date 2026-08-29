'use strict';

const normalizeId = (value) => String(value === undefined || value === null ? '' : value).trim();

class LearningWordbookRouteError extends Error {
  constructor(code, userMessage) {
    super(code);
    this.name = 'LearningWordbookRouteError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

const fail = (code, userMessage) => {
  throw new LearningWordbookRouteError(code, userMessage);
};

const resolveExplicitWordbook = async (wordbookId, repository) => {
  const normalizedId = normalizeId(wordbookId);
  if (!normalizedId) {
    return null;
  }
  if (!repository) {
    fail('WORDBOOK_REPOSITORY_REQUIRED', '指定词书暂时无法读取，当前不可学习');
  }

  if (normalizedId.startsWith('twb_')) {
    let teacherBooks;
    try {
      teacherBooks = await repository.getTeacherWordbooks({ scope: 'manage' });
    } catch (error) {
      fail('TEACHER_WORDBOOK_ROUTE_UNAVAILABLE', '教师词书暂时无法读取，当前不可学习');
    }

    const book = (Array.isArray(teacherBooks) ? teacherBooks : []).find((candidate) => (
      normalizeId(candidate && (candidate.wordbookId || candidate.id)) === normalizedId
    ));
    if (!book) {
      fail('TEACHER_WORDBOOK_NOT_FOUND', '教师词书不存在或无权访问，当前不可学习');
    }

    const status = normalizeId(book.status);
    if (status === 'disabled') {
      fail('TEACHER_WORDBOOK_DISABLED', '词书已停用，当前不可学习');
    }
    if (status === 'draft') {
      fail('TEACHER_WORDBOOK_DRAFT', '词书尚未发布，当前不可学习');
    }
    if (status !== 'active') {
      fail('TEACHER_WORDBOOK_NOT_ACTIVE', '词书当前不可学习');
    }
    return book;
  }

  const officialBooks = typeof repository.getOfficialWordbooks === 'function'
    ? repository.getOfficialWordbooks()
    : [];
  const officialBook = (Array.isArray(officialBooks) ? officialBooks : []).find((candidate) => (
    normalizeId(candidate && (candidate.wordbookId || candidate.id)) === normalizedId
  ));
  if (!officialBook) {
    fail('OFFICIAL_WORDBOOK_NOT_FOUND', '指定词书不存在，当前不可学习');
  }
  return officialBook;
};

module.exports = {
  LearningWordbookRouteError,
  resolveExplicitWordbook
};

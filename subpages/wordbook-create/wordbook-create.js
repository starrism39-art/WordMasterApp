'use strict';

const TeacherWordbookUpload = require('../../utils/teacher-wordbook-upload');

const decodeQueryText = (value) => {
  const text = String(value || '');
  try {
    return decodeURIComponent(text);
  } catch (error) {
    return text;
  }
};

const parseNonNegativeInteger = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
};

const ERROR_MESSAGES = Object.freeze({
  NAME_REQUIRED: '请输入词书名称',
  NAME_TOO_LONG: '词书名称不能超过50个字符',
  CATEGORY_TOO_LONG: '分类不能超过30个字符',
  DESCRIPTION_TOO_LONG: '描述不能超过500个字符',
  DUPLICATE_NAME: '你已经有同名词书，请更换名称',
  OFFICIAL_NAME_RESERVED: '该名称已被官方词书使用，请更换名称',
  UNSUPPORTED_FILE_TYPE: '请选择CSV或XLSX文件',
  INVALID_FILE_SIZE: '文件必须大于0且不超过5MB',
  INVALID_FORMAT: '文件格式无效，请检查表头和内容',
  STAGING_FILE_UNAVAILABLE: '暂存文件不可用，请重新选择文件',
  PREVIEW_NOT_READY: '解析尚未完成，请稍后重试',
  NO_VALID_ROWS: '没有可发布的有效词条',
  CONFIRMATION_REQUIRED: '请确认后再发布'
});

Page({
  data: {
    mode: 'create',
    name: '',
    category: '',
    description: '',
    submitting: false,
    errorMessage: '',
    wordbookId: '',
    draftBook: null,
    selectedFile: null,
    fileSizeText: '',
    fileExtensionLabel: '',
    uploadId: '',
    publishToken: '',
    uploadStage: '',
    uploadStatusText: '',
    processing: false,
    summary: null,
    validPreview: [],
    errorPreview: [],
    publishing: false,
    publishedVersion: null,
    currentVersion: 0,
    currentTotalWords: 0
  },

  onLoad: function(options) {
    const mode = options && options.mode === 'update' ? 'update' : 'create';
    const wordbookId = String(options && options.wordbookId || '').trim();
    const title = decodeQueryText(options && options.title || (
      mode === 'update' ? '教师词书' : '教师词书草稿'
    ));
    const currentVersion = parseNonNegativeInteger(options && options.version);
    const currentTotalWords = parseNonNegativeInteger(options && options.totalWords);

    this.setData({
      mode,
      currentVersion,
      currentTotalWords
    });

    if (wordbookId) {
      this.setData({
        wordbookId,
        draftBook: {
          wordbookId,
          title,
          status: mode === 'update' ? 'active' : 'draft'
        }
      });
    } else if (mode === 'update') {
      this.setData({ errorMessage: '词书信息无效，请返回词书中心重试' });
    }
  },

  onNameInput: function(event) {
    this.setData({
      name: event.detail.value,
      errorMessage: ''
    });
  },

  onCategoryInput: function(event) {
    this.setData({
      category: event.detail.value,
      errorMessage: ''
    });
  },

  onDescriptionInput: function(event) {
    this.setData({
      description: event.detail.value,
      errorMessage: ''
    });
  },

  resolveErrorMessage: function(result) {
    if (result && result.error === 'VERSION_CONFLICT') {
      return '版本已更新，请刷新后重试。';
    }

    if (result && ERROR_MESSAGES[result.reason]) {
      return ERROR_MESSAGES[result.reason];
    }

    if (result && result.error === 'UNAUTHORIZED') {
      return '登录状态无效，请重新进入小程序';
    }

    if (result && result.error === 'TEACHER_NOT_FOUND') {
      return '当前账号不是已登记教师';
    }

    return this.data.mode === 'update'
      ? '更新失败，请稍后重试'
      : '创建失败，请稍后重试';
  },

  formatFileSize: function(size) {
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  },

  submitDraft: async function() {
    if (this.data.mode === 'update' || this.data.submitting) return;

    if (!String(this.data.name || '').trim()) {
      this.setData({ errorMessage: ERROR_MESSAGES.NAME_REQUIRED });
      return;
    }

    this.setData({
      submitting: true,
      errorMessage: ''
    });

    try {
      const response = await wx.cloud.callFunction({
        name: 'teacherWordbook',
        data: {
          action: 'createDraft',
          name: this.data.name,
          category: this.data.category,
          description: this.data.description
        }
      });
      const result = response && response.result ? response.result : response;

      if (!result || result.success !== true) {
        this.setData({ errorMessage: this.resolveErrorMessage(result) });
        return;
      }

      wx.showToast({
        title: '草稿创建成功',
        icon: 'success'
      });
      this.setData({
        wordbookId: result.book.wordbookId,
        draftBook: result.book,
        uploadStage: 'draft_ready',
        uploadStatusText: '草稿已建立，可以上传CSV或XLSX文件'
      });
    } catch (error) {
      console.error('创建教师词书草稿失败:', error);
      this.setData({ errorMessage: '网络异常，请稍后重试' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  chooseAndUpload: async function() {
    if (this.data.processing || !this.data.wordbookId) return;

    this.setData({
      errorMessage: '',
      uploadId: '',
      publishToken: '',
      summary: null,
      validPreview: [],
      errorPreview: [],
      publishedVersion: null
    });

    let file;
    try {
      file = await TeacherWordbookUpload.chooseFile(wx);
    } catch (error) {
      if (error && /cancel/i.test(error.errMsg || error.message || '')) return;
      this.setData({ errorMessage: this.resolveErrorMessage(error && error.result) });
      return;
    }

    this.setData({
      selectedFile: file,
      fileSizeText: this.formatFileSize(file.size),
      fileExtensionLabel: file.extension.toUpperCase(),
      processing: true,
      uploadStage: 'preparing',
      uploadStatusText: '正在创建安全上传任务...'
    });

    const stageText = {
      preparing: '正在创建安全上传任务...',
      uploading: '正在上传到教师词书暂存区...',
      parsing: '云端正在解析并校验词条...',
      preview: '解析完成，正在生成预览...'
    };

    try {
      const outcome = await TeacherWordbookUpload.prepareAndParse({
        wxApi: wx,
        wordbookId: this.data.wordbookId,
        file,
        onStage: (stage) => {
          this.setData({
            uploadStage: stage,
            uploadStatusText: stageText[stage] || '处理中...'
          });
        }
      });
      this.setData({
        uploadId: outcome.uploadId,
        publishToken: outcome.publishToken || '',
        uploadStage: 'preview_ready',
        uploadStatusText: '预览已生成，请确认有效词条后发布',
        summary: outcome.preview.summary,
        validPreview: outcome.preview.validPreview || [],
        errorPreview: outcome.preview.errorPreview || []
      });
    } catch (error) {
      const result = error && error.result;
      this.setData({
        uploadId: result && result.uploadId ? result.uploadId : '',
        publishToken: '',
        uploadStage: result && result.upload ? result.upload.status : 'failed',
        uploadStatusText: '处理失败，请修正文件后重新上传',
        summary: result && result.summary ? result.summary : null,
        errorPreview: result && (result.errors || result.errorPreview)
          ? (result.errors || result.errorPreview)
          : [],
        errorMessage: this.resolveErrorMessage(result)
      });
    } finally {
      this.setData({ processing: false });
    }
  },

  confirmPublish: async function() {
    if (this.data.publishing
      || !this.data.uploadId
      || !this.data.summary
      || this.data.summary.validRows < 1) return;

    if (this.data.mode === 'update' && !this.data.publishToken) {
      this.setData({ errorMessage: '更新凭证已失效，请重新选择文件' });
      return;
    }

    const isUpdate = this.data.mode === 'update';
    const modal = await new Promise((resolve) => {
      wx.showModal({
        title: isUpdate ? '确认更新词书' : '确认发布词书',
        content: `将${isUpdate ? '更新为' : '发布'}${this.data.summary.validRows}条有效词条，失败数据不会进入正式词书。`,
        confirmText: isUpdate ? '确认更新' : '确认发布',
        success: resolve,
        fail: () => resolve({ confirm: false })
      });
    });
    if (!modal.confirm) return;

    this.setData({ publishing: true, errorMessage: '' });
    try {
      const request = {
        wxApi: wx,
        wordbookId: this.data.wordbookId,
        uploadId: this.data.uploadId
      };
      const result = isUpdate
        ? await TeacherWordbookUpload.updateVersion({
          ...request,
          publishToken: this.data.publishToken
        })
        : await TeacherWordbookUpload.publish(request);
      const publishedVersion = result.version;
      this.setData({
        uploadStage: 'published',
        uploadStatusText: isUpdate ? `词书已更新至v${publishedVersion.version}` : '词书已正式发布',
        publishedVersion,
        currentVersion: publishedVersion.version,
        currentTotalWords: publishedVersion.totalWords
      });
      wx.showToast({ title: isUpdate ? '词书更新成功' : '词书发布成功', icon: 'success' });
    } catch (error) {
      this.setData({ errorMessage: this.resolveErrorMessage(error && error.result) });
    } finally {
      this.setData({ publishing: false });
    }
  }
});

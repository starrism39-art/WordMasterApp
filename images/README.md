# 图片资源说明

本目录用于存放WordMasterApp小程序所需的图片资源。

## 必需的图片文件

由于当前项目配置中引用了以下图片资源，请确保添加这些文件：

### 默认头像
- `avatar_default.png` - 默认用户头像

### 学生头像（可选）
- `student_avatar_1.png`
- `student_avatar_2.png`
- ...

### 界面图标（可选）
- `empty_records.png` - 空记录提示图标
- `bookmark.png` - 收藏图标
- `bookmark_selected.png` - 已收藏图标
- `check.png` - 勾选图标
- `close.png` - 关闭图标
- `refresh.png` - 刷新图标
- `search.png` - 搜索图标

## 图片命名规范

- 使用小写字母和下划线
- 清晰描述图片用途
- 对于有选中状态的图标，使用`_selected`后缀

## 图片格式建议

- 优先使用PNG格式保证透明度
- 保持适当的图片尺寸（建议不超过100KB）
- 对于简单图标，考虑使用SVG格式

## 替代方案

如果暂时无法提供图片资源，可以在代码中使用emoji或纯文本替代，例如：
- 默认头像可以使用 '👤' emoji
- 功能图标可以使用相应的emoji替代
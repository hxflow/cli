---
name: api-docs
description: |
  根据后端 TypeScript 代码自动生成 API 接口文档（Markdown 格式）。
  当用户提到"生成文档"、"写接口文档"、"生成 API doc"、"补文档"，
  或上传了 Controller/Route 文件并询问接口用法时，使用本 Skill。
  即使用户只说"帮我把这个接口记录下来"，也应触发。
  不适用于前端组件文档或代码注释补全。
---

# API 文档生成

## 前置条件

1. 确认输出格式：Markdown（默认）或 OpenAPI YAML
2. 如果用户未提供文件，请求 Controller 文件路径
3. 读取 `docs/requirement/error-codes.md` 获取错误码定义

## 执行步骤

### 第一步：分析接口结构

读取 Controller 文件，提取：

- 路由路径和 HTTP 方法
- 请求体类型（从 `src/types/` 对应文件读取，不要自行推断）
- 响应体类型和 HTTP 状态码
- 认证方式（从中间件注入判断）
- 可能的错误码（对照 error-codes.md）

### 第二步：生成文档

每个接口按以下格式输出：

```markdown
## [METHOD] /api/[path]

**认证**: Bearer Token / 无需认证

**请求体**:
| 字段 | 类型 | 必须 | 说明 |

**响应 200**:
| 字段 | 类型 | 说明 |

**错误码**:
| Code | HTTP | 说明 |
```

## 输出规范

- 路径: `/mnt/user-data/outputs/api-[feature-name].md`
- 完成后调用 `present_files`
- 同时建议用户将文件纳入 `docs/` 版本控制，并在对应需求文档中建立引用

## 不适用场景

- 前端组件接口文档 → 手动维护 Props 定义
- 数据库 Schema 文档 → 参考 `docs/requirement/[schema].md`

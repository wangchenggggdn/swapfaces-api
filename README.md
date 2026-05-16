# swapfaces-api

<!-- 项目说明：Cloudflare Worker 代理 Swapfaces 官网 API，访客登录后拉取账号详情，把 token 与账号字段写入 D1 -->

Cloudflare Worker：向 Swapfaces 登录、拉取账号详情，将 token 与账号字段持久化到 D1。

## 接口一览

<!-- 基址：本地 wrangler dev 默认端口；线上为已绑定的自定义域名 -->

- 本地：`http://127.0.0.1:8787`
- 生产：`https://api.opengoon.art`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 存活探测；**204 No Content**，无 JSON 正文。 |
| `GET` | `/accounts` | 列出 D1 中已同步账号。 |
| `GET` | `/accounts/random` | 随机取一条账号记录。 |
| `POST` | `/sync` | 访客登录 Swapfaces、拉详情并 upsert 到 D1。 |
| `POST` | `/image-to-image` | 从 D1 随机取 token 调官网图生图；异步刷新账号详情。 |
| `POST` | `/upload/presign` | 随机 token 调官网上传预签名；query/头与官网一致；响应体与上游一致（`code`、`message`、`result`）。 |
| `POST` | `/unlimit-face-swapper/detect` | 随机 token 调人脸检测；将 `action_id` 与**同一** `token` 写入 `image_tasks`。 |
| `GET` | `/action/info/:actionId` | 按 `action_id` 查 `image_tasks` 取 token，调官网 `action/info`；成功时 `state=2`。 |
| `POST` | `/unlimit-face-swapper/swap` | 随机 token 调换脸；`action_id` 与 token 写入 `image_tasks`。 |
| `POST` | `/unlimit-face-swapper/swap-from-two` | 仅传 `imageUrl` + `sourceUrl`：**并行**对两张图 detect 取人脸，再 swap；**仅将 swap 的 actionId** 写入 `image_tasks`。 |
| `GET` | `/face-swapper/tasks/:actionId` | 用表中 token 查官网 action history（`image_unlimit_face_swapper`）；形态类似 `GET /image-tasks/:actionId`。 |
| `GET` | `/image-tasks/:actionId` | 用表中 token 查官网 history（`image_image_to_image`）。 |

## Curl 集成测试

<!-- 脚本路径与 npm 脚本；RUN_UPSTREAM 会真实扣额度，慎用 -->

仓库脚本 `scripts/test-api-curl.sh`：用 **HTTP 状态码**（可选 **jq** 校验 JSON）做轻量用例。

```bash
# 本地（需另开终端先执行 npm run dev）
BASE_URL=http://127.0.0.1:8787 npm run test:curl

# 生产环境
BASE_URL=https://api.opengoon.art npm run test:curl

# 额外执行会请求 Swapfaces 的链式用例（可能扣额度）
RUN_UPSTREAM=1 BASE_URL=https://api.opengoon.art npm run test:curl
```

手写 curl 时：`-o body.txt -w '%{http_code}'` 同时保存正文与状态码；再用 `jq -e '...'` 断言字段。

## 环境与部署

1. 安装依赖：

   ```bash
   npm install
   ```

2. 若尚未创建 D1：

   ```bash
   npx wrangler d1 create swapfaces
   ```

3. 将命令输出里的 `database_id` 填入 `wrangler.jsonc`。

4. 执行迁移（本地加 `--local`）：

   ```bash
   npx wrangler d1 migrations apply swapfaces
   ```

5. 本地开发：

   ```bash
   npm run dev
   ```

## 手动同步示例

```bash
curl -X POST http://127.0.0.1:8787/sync \
  -H 'Content-Type: application/json' \
  -d '{}'
```

也可覆盖登录体中的部分字段，例如：

```json
{
  "platform": "guest",
  "website": "swapfaces",
  "device": {
    "screenWidth": 1728,
    "screenHeight": 1117
  }
}
```

## 图生图（image-to-image）

<!-- 不接受调用方传 token，一律从 D1 随机选 -->

`POST /image-to-image` 要求 JSON body，**不接受**调用方自带 token，Worker 从 D1 随机取 token。

- **必填**：`imageUrl`（非空字符串）
- **可选**：`style`（默认 `undress`）；`website`（默认 `swapfaces`）

```bash
curl -X POST https://api.opengoon.art/image-to-image \
  -H 'Content-Type: application/json' \
  -d '{
    "imageUrl": "https://files.swapfaces.ai/Swapfaces.AI_20260510_44554a35-1085-47be-8bb5-dcc81d38c0fc.jpeg",
    "style": "undress",
    "website": "swapfaces"
  }'
```

上游成功后：写入 `image_tasks`，并异步刷新 D1 中的账号详情。

## 上传预签名（upload presign）

<!-- 与官网 curl 一致：query、空 body、text/plain 头 -->

`POST /upload/presign` 同样**不接受**调用方 token；随机账号请求官网预签名接口。

**Query（均可选，缺省与官网一致）**

| 参数 | 默认 |
| --- | --- |
| `action_type` | `image_unlimit_face_swapper` |
| `content_type` | `image/jpeg`（上游 URL 中为 `image%2Fjpeg`） |

也可在 JSON body 中传 `action_type` / `content_type`（或驼峰 `actionType` / `contentType`）；**同名时 query 优先**。

成功时响应为**上游原始 JSON**（无 `{ ok, data }` 包裹），例如：

```json
{
  "code": 200,
  "message": "Success",
  "result": {
    "presignUrl": "https://files.swapfaces.ai/....jpeg",
    "url": "https://files.swapfaces.ai/....jpeg"
  }
}
```

```bash
# query 使用默认值，等价于官网 curl
curl -X POST \
  'https://api.opengoon.art/upload/presign?action_type=image_unlimit_face_swapper&content_type=image%2Fjpeg'
```

若 `swapfaces_accounts` 无数据：HTTP **503**，body 形如 `{ "code": 503, "message": "...", "result": null }`。

## 人脸检测与 action 详情

<!-- detect 与 action/info 必须用同一 token，故写入 image_tasks -->

检测接口从 D1 **随机**取 token（与 presign 相同模式）；返回的 `actionId` 与 token 一并写入 **`image_tasks`**，后续查询用**同一 token**。

- **`POST /unlimit-face-swapper/detect`**：body 需 `imageUrl`；可选 `website`（默认 `swapfaces`）。
- **`GET /action/info/:actionId`**：按 `action_id` 读表取 token，请求官网 `GET /api/action/info?...`；query 可选 `website`。当 `result.status === "success"` 时将任务行 `state` 置为 `2`。

```bash
curl -X POST https://api.opengoon.art/unlimit-face-swapper/detect \
  -H 'Content-Type: application/json' \
  -d '{"imageUrl":"https://files.swapfaces.ai/your.jpeg","website":"swapfaces"}'

# 将上一步返回的 actionId 替换进 URL
curl -sS "https://api.opengoon.art/action/info/228212342?website=swapfaces"
```

## 两张图一键换脸（swap-from-two）

<!-- 目标图 imageUrl、来源图 sourceUrl 各走一次 detect，Promise.all 并行；再 swap -->

传**目标图** `imageUrl` 与**来源图** `sourceUrl`（均为可访问的图片 URL）。Worker 使用**同一**随机账号 token：

1. **并行**：对 `imageUrl` detect → `targetFaceUrl`（目标图上要被替换的人脸位置）；
2. **并行**：对 `sourceUrl` detect → `targetFaceUrl2`（来源图上要换上去的人脸位置）；
3. 两步都成功后调用 swap：`imageUrl` + `items: [{ faceUrl: targetFaceUrl, sourceUrl: targetFaceUrl2 }]`（上游字段名仍为 `sourceUrl`，值为来源图 detect 出的人脸 URL）。

仅将**最终 swap** 的 `actionId` 写入 `image_tasks`。

- **必填**：`imageUrl`、`sourceUrl`
- **可选**：`website`（默认 `swapfaces`）

成功时响应在官网 swap 字段基础上附加：`detectActionId`（目标图 detect）、`detectActionIdSource`（来源图 detect）、`targetFaceUrl`、`targetFaceUrl2`（及别名 `faceUrl`、`sourceFaceUrl`）。

```bash
curl -X POST https://api.opengoon.art/unlimit-face-swapper/swap-from-two \
  -H 'Content-Type: application/json' \
  -d '{
    "imageUrl": "https://picx.zhimg.com/v2-4d534ac6c6d54992d82e9ab6e7e4f839_r.jpg?source=1def8aca",
    "sourceUrl": "https://www.customerparadigm.com/images/photography/colorado/Boulder-Denver/Professional-Headshots/professional-photographer-boulder-colorado-fiona.jpg",
    "website": "swapfaces"
  }'
```

## 换脸与历史任务查询

- **`POST /unlimit-face-swapper/swap`**：body 需 `imageUrl`、`items`（元素为 `{ faceUrl, sourceUrl }`）；可选 `website`。返回的 `actionId` 与所用 token 写入 **`image_tasks`**。
- **`GET /face-swapper/tasks/:actionId`**：从表取 token，请求官网 action history，且 `actionTypes` 为 `image_unlimit_face_swapper`；匹配行 `status === "success"` 时更新 `state = 2`。

```bash
curl -X POST https://api.opengoon.art/unlimit-face-swapper/swap \
  -H 'Content-Type: application/json' \
  -d '{"imageUrl":"https://files.swapfaces.ai/base.jpeg","items":[{"faceUrl":"https://files.swapfaces.ai/face.png","sourceUrl":"https://files.swapfaces.ai/source.jpeg"}],"website":"swapfaces"}'

curl -sS "https://api.opengoon.art/face-swapper/tasks/228214030"
```

## 图生图任务查询（image-tasks）

`GET /image-tasks/:actionId`：用表中 token 查官网 history（`image_image_to_image` 类型）。

```bash
curl -X GET https://api.opengoon.art/image-tasks/1234567890
```

D1 中无记录时返回 **404**：

```json
{
  "ok": false,
  "error": "Task not found"
}
```

## 随机账号

```bash
curl -X GET https://api.opengoon.art/accounts/random
```

表为空时：

```json
{
   "ok": true,
   "data": null
}
```

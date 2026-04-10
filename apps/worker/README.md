# @indexa/worker

Python 向量化 worker，消费 `IndexJob` 队列，把上传的文档解析 → 切分 → embedding → 写入 Qdrant，并推进 `DocumentIndexState` 到 `READY`。

两种运行模式：

- **`watch`**（推荐）：常驻进程，通过 Postgres `LISTEN indexa_job` 实时唤醒。前端上传后 Node 在事务内 `NOTIFY`，worker 亚秒级响应。30 秒兜底 poll 防通知丢失。这是 `pnpm dev` 启动的模式。
- **`run`**：一次性脚本，跑完 QUEUED 队列即退出。给 cron / launchd 用，也可作为 `watch` 旁边的 disaster recovery。

## 依赖

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) 包管理器
- 本地可访问的 Postgres（和 `apps/server` 同一个实例）
- 本地或远程 Qdrant（`docker run -p 6333:6333 qdrant/qdrant`）
- DashScope (阿里云百炼) API key，用于 QWEN text-embedding-v3

## 初始化

```bash
cd apps/worker
cp .env.example .env        # 填 DASHSCOPE_API_KEY 等
uv sync                     # 安装依赖到 .venv
```

## 运行

### watch 模式（实时）

```bash
uv run python -m indexa_worker watch
```

- 启动时先扫一遍 `QUEUED` 任务，然后 `LISTEN indexa_job`
- 收到 `NOTIFY` 立刻 `claim_jobs()` + 处理
- 如果 30 秒内没有通知，也会兜底 poll 一次，防通知丢失
- `SIGINT` / `SIGTERM` 优雅退出（最多等一轮 poll 完成）
- 在 monorepo 根运行 `pnpm dev` 会自动拉起这个模式

### run 模式（一次性）

```bash
uv run python -m indexa_worker run --batch 5 --worker-id dev
```

- `--batch N`：一次最多 claim N 个 QUEUED 任务，默认走 `WORKER_BATCH_SIZE`
- `--worker-id ID`：用于 `IndexJob.workerId` 字段，便于追踪
- 跑完一批就退出，适合 cron / launchd / k8s CronJob

cron 样例（每分钟兜底跑一次，配合 `watch` 使用）：

```cron
* * * * * cd /Users/bencode/work/lesscap/indexa/apps/worker && /opt/homebrew/bin/uv run python -m indexa_worker run >> /tmp/indexa-worker.log 2>&1
```

## 管线阶段

两种模式共用同一个管线：
1. 从 Postgres 抢占 `QUEUED` 任务（`SELECT ... FOR UPDATE SKIP LOCKED`）
2. 按顺序执行 PARSING → CHUNKING → EMBEDDING → UPSERTING → FINALIZING
3. `run` 写完所有任务后自然退出；`watch` 回到 LISTEN 等下一轮

## 协作边界

- Node 端（`apps/server`）负责创建 `IndexJob(status=QUEUED)`，并在同一事务里发 `pg_notify('indexa_job', <job_id>)` 唤醒本 worker
- Python 端（本模块）负责把它跑到 `SUCCEEDED` 或 `FAILED`
- 两边共享 Postgres schema（`apps/server/prisma/schema.prisma` 是唯一真相）
- 两边必须指向同一份文件存储（`DOCUMENT_STORAGE_ROOT`）

## 测试

```bash
uv run pytest
```

## 限制 (MVP)

- 不支持 `.docx` / `.html`（只 `.txt` / `.md` / `.pdf`）
- 没有自动重试，失败后需要手动 re-queue
- 没有僵尸 job 清理（TODO）

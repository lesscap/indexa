# @indexa/worker

Python 向量化 worker，消费 `IndexJob` 队列，把上传的文档解析 → 切分 → embedding → 写入 Qdrant，并推进 `DocumentIndexState` 到 `READY`。

定位：一次性脚本，由外部 cron / launchd 定时触发。不是常驻进程。

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

```bash
uv run python -m indexa_worker run --batch 5 --worker-id dev
```

- `--batch N`：一次最多 claim N 个 QUEUED 任务，默认走 `WORKER_BATCH_SIZE`
- `--worker-id ID`：用于 `IndexJob.workerId` 字段，便于追踪

脚本会：
1. 从 Postgres 抢占 QUEUED 任务（`SELECT ... FOR UPDATE SKIP LOCKED`）
2. 按顺序执行 PARSING → CHUNKING → EMBEDDING → UPSERTING → FINALIZING
3. 写完所有任务后自然退出

## 定时触发

macOS / Linux cron 样例（每分钟跑一次）：

```cron
* * * * * cd /Users/bencode/work/lesscap/indexa/apps/worker && /opt/homebrew/bin/uv run python -m indexa_worker run >> /tmp/indexa-worker.log 2>&1
```

生产环境也可以用 k8s CronJob / systemd timer。

## 协作边界

- Node 端（`apps/server`）负责创建 `IndexJob(status=QUEUED)`
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

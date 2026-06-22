# Writeflow

Writeflow is a local-first, human-in-the-loop writing studio for multi-agent writing workflows.

Milestone 1 includes:

- Standalone Next.js web app
- Local SQLite metadata model
- Local project directory initialization
- Novel memory templates
- Project list and creation flow
- Three-column writing workspace shell
- Memory, runs, and settings pages

## Run locally

```bash
npm install
npm run db:push
npm run dev
```

Open http://localhost:3000.

## Environment

Copy `.env.example` to `.env.local` before model work begins:

```bash
cp .env.example .env.local
```

Milestone 2 will use the OpenAI-compatible settings from this file.

## Project storage

By default, project data lives in `data/`:

```text
data/
├── writeflow.sqlite
└── projects/
    └── {projectId}/
        ├── memory/
        ├── artifacts/
        └── runs/
```

Long-form writing memory is stored as Markdown so it stays readable and portable.

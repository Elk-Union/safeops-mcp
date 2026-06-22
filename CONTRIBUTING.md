# Contributing to SAFEOPS MCP

We welcome contributions to SAFEOPS MCP! To ensure high-quality software, safety-focused features, and standard developer workflows, please review our contribution and branching guidelines below.

---

## 1. Branching Strategy & Workflow

To maintain production stability on critical system governance, we enforce a strict branching protocol:

1. **Main Branch (`main`)**: Reflects the stable, production-ready codebase. Direct pushes to `main` are restricted.
2. **Development Branch (`dev`)**: The primary integration branch where new features, bug fixes, and documentation upgrades are combined.
3. **Feature Branches (`feature/your-feature-name`)**: Developers should branch off `dev` for active tasks.

### Contribution Lifecycle

```text
[Feature Branch] ---> [Pull Request] ---> [dev Branch] ---> [Staging/PR] ---> [main Branch]
```

1. Create a feature branch off `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/my-cool-feature
   ```
2. Commit your changes and push them to your branch:
   ```bash
   git push -u origin feature/my-cool-feature
   ```
3. Open a Pull Request (PR) targeting the `dev` branch.
4. Once reviewed, merged, and validated on staging, the `dev` branch is merged into `main` for release.

---

## 2. Coding Standards

### Backend (Python FastAPI)
- **Style**: Follow PEP 8 guidelines.
- **Type Hints**: Enforce strict type hints on all function signatures.
- **Validation**: Use Pydantic models for incoming and outgoing HTTP payload serialization.
- **Database Modifiers**: Never perform raw query string formatting. Use SQLAlchemy Core or ORM expressions.
- **Error Handling**: Use structured API exceptions returning meaningful JSON responses.

### Frontend (Next.js 15 / TypeScript)
- **Style**: Follow Next.js App Router conventions.
- **Types**: Define explicit TypeScript interfaces; avoid `any`.
- **Styling**: Use Tailwind CSS variables conforming to our cybersecurity dark-mode palettes (sleek borders, minimal layouts).

---

## 3. Local Development Setup

### Backend Prerequisites
1. Set up a Python 3.12+ virtual environment:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Run the development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Frontend Prerequisites
1. Navigate to the frontend directory and install packages:
   ```bash
   cd frontend
   npm install
   ```
2. Boot the Next.js development server:
   ```bash
   npm run dev
   ```

---

## 4. Submitting Pull Requests

When submitting a Pull Request to `dev`:
- Provide a clear, descriptive summary of changes.
- Cite the relevant issues resolved.
- Include verification logs (e.g. screenshots of manual tests, passing CLI tests).
- Ensure all automated unit tests pass.

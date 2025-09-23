# Repository Guidelines

## Project Structure & Module Organization
This workspace hosts three active apps: `lmslocal-web` (Next.js/TypeScript) with feature routes under `src/app/**`, reusable UI in `src/components`, shared helpers in `src/lib`, and static assets in `public`. `lmslocal-server` exposes the Express API; request handlers live in `routes/`, cross-cutting logic in `services/` and `utils/`, with PostgreSQL access centralized in `database.js`. `lmslocal-flutter` contains the mobile client; core widgets sit in `lib/`, data models in `lib/models`, providers in `lib/providers`, and widget tests in `test/`. Reference material and schema diagrams reside in `docs/`.

## Build, Test, and Development Commands
- Web: `cd lmslocal-web && npm install && npm run dev` for local dev, `npm run build` for production bundles, `npm run lint` for static checks.
- Server: `cd lmslocal-server && npm install && npm run dev` (nodemon on port 3015) or `npm start` for production.
- Mobile: `cd lmslocal-flutter && flutter pub get`, then `flutter run -d chrome` or a device target; run `flutter test` for unit/widget suites.

## Coding Style & Naming Conventions
Use two-space indentation across projects. Web code follows ESLint's Next.js rules: prefer TypeScript, keep React components PascalCase, group Tailwind utility classes layout > spacing > color, and favor named exports in `src/lib`. Server modules stick to CommonJS with single quotes; route files stay kebab-cased and export async handlers. Flutter adheres to `flutter_lints`: widget classes UpperCamelCase, file names snake_case, and format with `dart format` (or `flutter format .`).

## Testing Guidelines
Automated coverage is light, so every feature PR must include linting plus a documented verification path. Run `npm run lint` for web changes, exercise critical API endpoints with Postman or curl (capture sample requests in the PR), and add `flutter test` cases when touching mobile stateful logic. New Express routes should ship with integration checks under `lmslocal-server/tests` using Jest + Supertest, or at minimum a reproducible manual test plan.

## Commit & Pull Request Guidelines
Git history favors short, imperative commit subjects (e.g., "Improve dashboard results load"). Group related changes per commit and avoid WIP messages. PRs should link tracked issues, describe behavior changes, list test commands run, and attach UI screenshots or recordings for web/mobile updates. Document any new environment variables in the PR and update `.env` templates when applicable.

## Environment & Security Notes
Per-app `.env` files supply secrets and stay git-ignored; copy from team-provided templates and never commit credentials. Limit production database access to the service account defined in `database.js`, rotate third-party API keys after local testing, and scrub logs before sharing traces.

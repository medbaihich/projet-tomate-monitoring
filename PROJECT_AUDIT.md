# Tomato Monitoring Project Audit

## Scope

This document audits the current repository without changing application code. It covers:

- Project architecture
- Technologies used
- How each part works
- Confirmed bugs and risks
- Enhancements and next steps

## Confirmed Findings

1. **High**: Backend automated tests are effectively not running. `python manage.py test` returned **0 tests**, even though real API tests exist in [backend/apps/core/tests.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/core/tests.py:5). The main cause is that `backend/apps/__init__.py` is missing, so `apps` behaves like a namespace package and Django discovery is unreliable.

2. **High**: Demo inference seed data points to files that do not exist. [backend/apps/core/management/commands/seed_demo_data.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/core/management/commands/seed_demo_data.py:112) references `ai_assets/models/tomato_similarity_model.bin`, and lines [123](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/core/management/commands/seed_demo_data.py:123) and [136](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/core/management/commands/seed_demo_data.py:136) reference `fruit.index` / `leaf.index`, while the actual configured FAISS files are [fruit_faiss.index / leaf_faiss.index](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/config.py:127).

3. **High**: Docker startup does not initialize the backend schema. The backend container only runs Django’s dev server in [backend/Dockerfile](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/Dockerfile:25), and `docker-compose.yaml` only uses plain [depends_on](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/docker-compose.yaml:82). There is no migration step, no DB healthcheck, and no seed/bootstrap step, so a fresh stack can start against an empty or not-yet-ready PostgreSQL instance.

4. **Medium**: Local frontend development is broken unless everything goes through Traefik. [frontend/src/api/axiosClient.js](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/api/axiosClient.js:5) assumes `baseURL: '/'`, but [frontend/vite.config.js](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/vite.config.js:1) has no `/api` proxy and the backend has no CORS setup. Running Vite on `:3000` and Django on `:8000` directly will send `/api/...` to Vite, not Django.

5. **Medium**: Frontend lint is currently failing with real code issues. Confirmed by `npm.cmd run lint`:

- [frontend/vite.config.js](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/vite.config.js:10) uses `__dirname` in an ESM config.
- [frontend/src/api/axiosClient.js](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/api/axiosClient.js:83) declares an unused `accessToken`.
- [frontend/src/layouts/MainLayout.jsx](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/layouts/MainLayout.jsx:32) disables `react/prop-types` even though that rule is not configured in [frontend/eslint.config.js](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/eslint.config.js:3).

6. **Medium**: The AI pipeline is not installable from the declared backend environment. [backend/requirements.txt](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/requirements.txt:1) only installs Django/DRF/Postgres pieces, but the AI scripts import OpenCV, NumPy, Pandas, TensorFlow, and FAISS in files like [backend/ai_assets/scripts/extract_embeddings.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/extract_embeddings.py:4) and [backend/ai_assets/scripts/search_query.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/search_query.py:6).

7. **Low**: `vectors` and `notifications` are registered in [backend/config/settings.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/config/settings.py:16) but are only partially implemented. [backend/apps/vectors/views.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/vectors/views.py:1) and [backend/apps/notifications/views.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/notifications/views.py:1) are placeholders, and there are no API routes for them in [backend/config/urls.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/config/urls.py:18).

8. **Low**: Auth persistence is fragile after page reload. [frontend/src/store/authStore.js](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/store/authStore.js:58) persists tokens and `isAuthenticated`, but not the user object, while [frontend/src/components/ProtectedRoute.jsx](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/components/ProtectedRoute.jsx:5) trusts only `isAuthenticated`. That can leave the UI inside protected routes with stale auth state.

## Technologies Used

### Backend

- **Django 5**
  Why: robust web framework with admin, ORM, and structured app organization.
  How it is used: project configuration and app wiring live in [backend/config/settings.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/config/settings.py:16) and [backend/config/urls.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/config/urls.py:18).

- **Django REST Framework**
  Why: fast API development with serializers, viewsets, authentication, pagination, and schema generation.
  How it is used: DRF is globally configured in [backend/config/settings.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/config/settings.py:103), and API endpoints are implemented across the app viewsets.

- **SimpleJWT**
  Why: stateless token-based authentication for frontend/backend separation.
  How it is used: JWT settings are defined in [backend/config/settings.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/config/settings.py:118), and auth endpoints are in [backend/apps/accounts/views.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/accounts/views.py:8).

- **PostgreSQL**
  Why: reliable relational database for structured operational data.
  How it is used: configured in [backend/config/settings.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/config/settings.py:65) and provisioned in [docker-compose.yaml](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/docker-compose.yaml:46).

### Frontend

- **React 19**
  Why: component-based SPA frontend for dashboards and operations screens.
  How it is used: entry point in [frontend/src/main.jsx](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/main.jsx:1) and route composition in [frontend/src/App.jsx](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/App.jsx:1).

- **Vite 8**
  Why: fast development server and modern frontend build tooling.
  How it is used: configured in [frontend/vite.config.js](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/vite.config.js:1).

- **React Router 7**
  Why: client-side routing for login, dashboard, review, devices, and catalog sections.
  How it is used: route tree is defined in [frontend/src/App.jsx](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/App.jsx:32).

- **Zustand**
  Why: lightweight auth state management.
  How it is used: auth store lives in [frontend/src/store/authStore.js](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/store/authStore.js:1).

- **React Query**
  Why: server-state fetching and caching.
  How it is used: query client is created in [frontend/src/App.jsx](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/App.jsx:17), though usage is still minimal.

- **Axios**
  Why: centralized HTTP client with interceptors for token handling.
  How it is used: request and refresh logic lives in [frontend/src/api/axiosClient.js](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/api/axiosClient.js:1).

- **Material UI**
  Why: ready-made UI components and consistent theming.
  How it is used: theme setup is in [frontend/src/theme.js](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/theme.js:1), and the layout/login UI uses MUI components.

### Infrastructure

- **Docker Compose**
  Why: local orchestration of frontend, backend, database, and reverse proxy.
  How it is used: service definitions live in [docker-compose.yaml](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/docker-compose.yaml:1).

- **Traefik**
  Why: reverse proxy that routes `/api` and `/admin` to Django and other paths to the frontend.
  How it is used: configured in [docker-compose.yaml](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/docker-compose.yaml:24).

### AI / ML Pipeline

- **OpenCV**
  Why: image reading, cropping, and preprocessing.
  How it is used: in [backend/ai_assets/scripts/build_final_dataset.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/build_final_dataset.py:5) and [backend/ai_assets/scripts/extract_embeddings.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/extract_embeddings.py:4).

- **NumPy / Pandas**
  Why: metadata manipulation and embedding storage.
  How it is used: throughout the AI scripts such as [backend/ai_assets/scripts/build_faiss.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/build_faiss.py:1).

- **TensorFlow MobileNetV2**
  Why: generate image embeddings for tomato disease similarity search.
  How it is used: model loading and embedding extraction happen in [backend/ai_assets/scripts/extract_embeddings.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/extract_embeddings.py:7) and [backend/ai_assets/scripts/search_query.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/search_query.py:9).

- **FAISS**
  Why: nearest-neighbor similarity search over embeddings.
  How it is used: index build and search are implemented in [backend/ai_assets/scripts/build_faiss.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/build_faiss.py:3) and [backend/ai_assets/scripts/search_query.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/search_query.py:10).

## How the Project Works

### 1. Authentication

- Backend auth endpoints are exposed under `/api/v1/auth/` in [backend/config/urls.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/config/urls.py:21).
- Login and token refresh are implemented in [backend/apps/accounts/views.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/accounts/views.py:8).
- The frontend login page posts credentials to `/api/v1/auth/login/`, then fetches `/api/v1/auth/me/` in [frontend/src/features/auth/Login.jsx](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/features/auth/Login.jsx:23).
- Auth state is stored in Zustand in [frontend/src/store/authStore.js](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/store/authStore.js:1).

### 2. Device and Location Hierarchy

- The operational structure is modeled as `Site -> Greenhouse -> Zone -> Device` in [backend/apps/devices/models.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/devices/models.py:6).
- CRUD endpoints are provided by DRF viewsets in [backend/apps/devices/views.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/devices/views.py:14).
- Nested serializers expose related children for easy frontend consumption in [backend/apps/devices/serializers.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/devices/serializers.py:21).

### 3. Disease Catalog

- Disease entities, causes, treatments, and resource links are modeled in [backend/apps/catalog/models.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/catalog/models.py:6).
- CRUD APIs are exposed in [backend/apps/catalog/views.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/catalog/views.py:19).
- This gives the project a knowledge base for inspection prediction and review workflows.

### 4. Inference Metadata

- Model versions and inference index metadata are stored in [backend/apps/inference/models.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/inference/models.py:6).
- These records describe which index belongs to which model and organ type.
- Important: this is metadata management, not a complete real-time inference API.

### 5. Inspection Workflow

- Inspections are modeled in [backend/apps/inspections/models.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/inspections/models.py:8).
- Each inspection references a device, inference index, predicted disease, organ type, and processing state.
- Candidate similarity matches are stored as ranked `InspectionMatch` rows.
- Creation logic is centralized in [backend/apps/inspections/services.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/inspections/services.py:11), which creates the inspection and its matches atomically.

### 6. Review Workflow

- Human review is modeled in [backend/apps/review/models.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/review/models.py:9).
- A review belongs one-to-one to an inspection and can accept, correct, or reject the predicted result.
- Validation for corrected reviews is enforced in [backend/apps/review/serializers.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/apps/review/serializers.py:25).

### 7. Frontend Application State

- The frontend has protected routes and a main shell in [frontend/src/App.jsx](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/App.jsx:37) and [frontend/src/layouts/MainLayout.jsx](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/frontend/src/layouts/MainLayout.jsx:1).
- At the moment, most pages are still placeholders: dashboard, review, devices, and catalog are not yet connected to backend data.

### 8. AI Dataset and Search Pipeline

- Dataset normalization and crop generation happen in [backend/ai_assets/scripts/build_final_dataset.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/build_final_dataset.py:1).
- Embeddings are extracted with MobileNetV2 in [backend/ai_assets/scripts/extract_embeddings.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/extract_embeddings.py:1).
- FAISS indexes are built in [backend/ai_assets/scripts/build_faiss.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/build_faiss.py:1).
- Image similarity search is done offline by [backend/ai_assets/scripts/search_query.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/ai_assets/scripts/search_query.py:1).
- This pipeline is currently separate from the Django API lifecycle.

## Bugs and Risks

### Backend

- Test discovery is not functioning properly.
- Demo seed data references missing model/index artifacts.
- No migration/bootstrap flow in container startup.
- Default secret key is insecure in both config and compose:
  [backend/config/settings.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/config/settings.py:9),
  [docker-compose.yaml](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/docker-compose.yaml:74).
- `DEBUG` defaults to `True` in [backend/config/settings.py](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/backend/config/settings.py:13).
- `vectors` and `notifications` apps are incomplete but enabled.

### Frontend

- Local dev API flow is not fully configured without Traefik.
- Lint currently fails.
- Build verification was not fully confirmed from this environment because `vite build` hit a local Windows permission/sandbox `spawn EPERM` issue.
- Protected routes trust persisted auth state more than verified session restoration.
- Most business pages are placeholders, so the frontend does not yet represent the full backend capability.

### Docker / Deployment

- Backend uses Django dev server in containers instead of a production server.
- No database healthcheck.
- No automatic migrations.
- Traefik dashboard is insecurely exposed with `--api.insecure=true` in [docker-compose.yaml](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/docker-compose.yaml:34).
- Postgres is exposed on host port `5432` in [docker-compose.yaml](/C:/Users/Lenovo/Desktop/projet-tomate-monitoring/docker-compose.yaml:56), which may be unnecessary outside local development.

### AI / Data Pipeline

- AI dependencies are not declared in backend requirements.
- AI pipeline is operationally separate from the main API.
- Repo includes a very large committed dataset, which can slow Git operations and container contexts.

## Enhancements

### Highest Priority

- Add `backend/apps/__init__.py` and fix test discovery.
- Add meaningful automated tests for each app.
- Align demo seed paths with real AI artifact paths.
- Add backend container entrypoint steps for `migrate` and startup readiness.
- Decide and implement a correct frontend-to-backend local dev strategy.

### Backend Improvements

- Replace `runserver` in Docker with a production-ready app server.
- Add healthchecks for database and backend.
- Add environment-specific settings for dev vs production.
- Add permissions by role instead of only global authentication.
- Either remove unfinished apps from `INSTALLED_APPS` or finish their APIs.

### Frontend Improvements

- Replace placeholder pages with real dashboards and CRUD screens.
- Rehydrate auth by validating stored tokens and refetching `/me` on app load.
- Introduce feature-level API hooks with React Query.
- Fix lint and build issues, then add CI checks.

### AI / ML Improvements

- Split AI dependencies into a dedicated requirements file or service.
- Expose a proper inference endpoint if real-time prediction is required.
- Store artifact metadata consistently and validate paths before seeding.
- Consider moving large training assets out of the main application repo if collaboration speed becomes a problem.

### DevOps Improvements

- Add `.env.example` files.
- Add CI for lint, tests, and build.
- Add separate Docker profiles for development and production.
- Secure or disable the Traefik dashboard in non-local environments.

## Verification Performed

- Ran `python manage.py test` in `backend`:
  result: **0 tests ran**
- Ran `npm.cmd run lint` in `frontend`:
  result: **3 lint errors confirmed**
- Ran `npm.cmd run build` in `frontend`:
  result: blocked by local environment `spawn EPERM`, so full build verification was not completed here

## Summary

The repository already contains a strong backend foundation for a tomato monitoring platform: authentication, device hierarchy, disease catalog, inspection workflow, review flow, and inference metadata are all modeled cleanly. The frontend shell and Docker stack are present, but the UI is still early-stage and the operational setup is not yet hardened.

The biggest current gaps are reliability and completeness:

- tests are not being discovered correctly
- Docker startup is not production-safe
- local frontend/backend integration is incomplete outside Traefik
- AI asset metadata is inconsistent with actual files
- several app areas exist only as placeholders

The project is a solid base, but it still needs a stabilization pass before it can be considered robust for team development or deployment.

Act as a Senior Software Architect and AI Coding Standards Expert.

I want you to generate a complete RULES.md file for my software company "CodeVista".

This rules file will be used by AI coding assistants (Cursor AI, Claude Code, GitHub Copilot, Windsurf, Cline, Roo Code, etc.) so that every feature generated follows the same architecture and coding standards.

Project Details

Company Name:
CodeVista

Tech Stack

Frontend
- React.js
- Vite
- React Router
- Axios
- CSS Modules / CSS
- Responsive Design

Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- bcrypt
- Multer
- Resend Email
- Cloudinary

Deployment
- Vercel
- Render

Version Control
- Git + GitHub

===================================================

The rules file should include the following sections.

1. Project Philosophy

- Never break existing features.
- Backward compatibility is mandatory.
- Existing APIs should not change unless explicitly requested.
- Existing database schema must not be modified without migration.
- Reuse code whenever possible.
- Do not create duplicate logic.

---------------------------------------------------

2. Folder Structure Rules

Enforce modular architecture.

Backend

controllers/
services/
routes/
middlewares/
models/
utils/
config/
validators/

Frontend

components/
pages/
hooks/
context/
services/
utils/

Never place business logic inside routes or React components.

---------------------------------------------------

3. Coding Standards

Use

const

instead of

let

whenever possible.

Use async/await.

Never use nested callbacks.

Always use meaningful variable names.

No magic numbers.

No duplicated code.

Maximum function length:
60 lines

Maximum component length:
250 lines

Split large components.

---------------------------------------------------

4. Express Rules

Routes should only

- validate input
- call controller

Controllers should

- receive request
- call services
- return response

Services should contain ALL business logic.

Never access database directly from controllers.

---------------------------------------------------

5. MongoDB Rules

Always

use lean()

for read-only queries.

Always

select()

only required fields.

Use indexes.

Validate ObjectId.

Never perform unnecessary queries.

---------------------------------------------------

6. Authentication Rules

Always use JWT middleware.

Never trust frontend data.

Always verify ownership.

Admin routes must use

authorize('admin')

middleware.

---------------------------------------------------

7. API Rules

RESTful naming.

Examples

GET /projects

POST /projects

PATCH /projects/:id

DELETE /projects/:id

Never create endpoints like

/getProjects

/createProject

---------------------------------------------------

8. Validation Rules

Use centralized validation.

Validate

email

password

phone

ObjectId

pagination

Never trust request body.

---------------------------------------------------

9. Error Handling

Use AppError.

Never return raw errors.

Use centralized error middleware.

Never expose stack traces.

---------------------------------------------------

10. Logging

Only log

important events.

Never log passwords.

Never log JWT tokens.

---------------------------------------------------

11. Security Rules

Sanitize inputs.

Escape HTML.

Rate limit APIs.

Use Helmet.

Enable CORS correctly.

Hash passwords using bcrypt.

Store secrets in environment variables.

---------------------------------------------------

12. Frontend Rules

Never call API directly inside components.

Always use services.

Keep components reusable.

Use loading states.

Use error states.

Use optimistic UI only when appropriate.

---------------------------------------------------

13. UI Rules

Responsive design required.

Desktop

Tablet

Mobile

Maintain spacing consistency.

Maintain typography consistency.

Use reusable cards.

Use reusable buttons.

---------------------------------------------------

14. Dashboard Rules

Every dashboard should have

Stats Cards

Recent Activity

Tables

Pagination

Search

Filters

Loading Skeleton

Empty State

Error State

---------------------------------------------------

15. Admin Panel Rules

Admin can

Manage Users

Manage Projects

Manage SRS Requests

Analytics

Notifications

Settings

---------------------------------------------------

16. User Dashboard Rules

User should only see

their own projects

their invoices

their notifications

their profile

their accepted SRS

their project progress

---------------------------------------------------

17. Code Review Rules

Before generating code always check

Will this break existing code?

Can existing code be reused?

Can this feature be modular?

Is there duplicated logic?

Is validation complete?

Is authentication handled?

---------------------------------------------------

18. Git Rules

Meaningful commit messages.

Feature branches.

No commented code.

No console logs before production.

---------------------------------------------------

19. Performance Rules

Avoid unnecessary renders.

Memoize expensive computations.

Lazy load pages.

Optimize Mongo queries.

Avoid N+1 queries.

---------------------------------------------------

20. Documentation Rules

Every exported function must have comments.

Complex logic must include explanation.

Every API should be documented.

---------------------------------------------------

21. AI Assistant Behavior

Before generating any code:

- Read existing files first.
- Understand current architecture.
- Never rewrite unrelated code.
- Never delete existing logic.
- Preserve coding style.
- Match naming conventions.
- Keep responses production-ready.
- If multiple files are affected, explain why.
- If assumptions are required, clearly state them.
- Prefer incremental changes over rewrites.

---------------------------------------------------

22. Feature Development Checklist

Before completing any feature ensure

✔ Existing features still work

✔ Authentication works

✔ Authorization works

✔ Validation complete

✔ Error handling added

✔ Loading states added

✔ Responsive UI

✔ No duplicate code

✔ API documented

✔ Code formatted

---------------------------------------------------

23. CodeVista Specific Rules

The system already contains

Authentication

Authorization

Admin Dashboard

User Dashboard

Project Management

SRS Requests

Email Notifications

Project Progress

Role Management

These systems must NEVER be rewritten.

Only extend existing functionality.

Maintain current code flow.

Do not rename existing APIs.

Do not change response structures unless requested.

Maintain backward compatibility.

Always integrate new features into existing architecture.

---------------------------------------------------

Generate this as a professional RULES.md document with clear headings, bullet points, examples, best practices, and checklists so it can be directly committed to the repository.
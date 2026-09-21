# Word Bridge

Word Bridge is a side project for language learning — it helps users expand
their vocabulary in an interactive way, with AI-generated quiz templates and
a timed exam mode.

Originally built as a project inside [pidashin/portfolio](https://github.com/pidashin/portfolio);
extracted into this standalone repo.

## Technologies Used

- **Next.js** – React framework for server-side rendering and API routes.
- **GraphQL** (Apollo Server + Client) – API layer for words, AI templates, and exam data.
- **Prisma** (SQLite via libSQL) – exam history persistence.
- **Hugging Face Inference API** – AI-generated fill-in-the-blank quiz templates.
- **Docker** – containerized deployment.

## Setup & Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/pidashin/wordbridge.git
   cd wordbridge
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Copy `.env.example` to `.env.local` and fill in your own values (see
   [AI_UI_SETUP.md](./AI_UI_SETUP.md) for the Hugging Face API key).
4. Create the local SQLite database (exam history — `User`/`ExamHistory` tables):
   ```sh
   npx prisma db push
   ```
   Docker does this automatically on container start; local `npm run dev` does not.
5. Start the development server:
   ```sh
   npm run dev
   ```
6. Open your browser and navigate to `http://localhost:3000`

## Docker

```sh
docker-compose up -d --build
```

---

🚀 _Thank you for visiting Word Bridge! Feel free to explore and contribute._

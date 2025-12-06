<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./static/darkmode.png">
  <source media="(prefers-color-scheme: light)" srcset="./static/lightmode.png">
  <img alt="Ecomm Hacks Banner" src="./static/lightmode.png">
</picture>

### Team Name
Unremarkable

### Team Members
Chris Yoo (@PenTest-duck)

### Demo
- **Live URL:** http://unremarkable-ai.vercel.app/
- **Demo Video:** See demo

### What We Built
Remark lets customers talk to product experts. Unremarkable lets customers and e-commerce businesses talk to buyer personas.

Customers can create and join a community of virtual buyer personas, where they can ask questions and seek advice.

Businesses can generate and run marketing experiments on synthetic customers and get immediate feedback.

### How It Works
Each virtual persona is created with Nano Banana Pro, and is represented by the Gemini LLM. 

The marketing campaigns are also generated with Nano Banana Pro.

### Key Features
- Customer community of virtual avatars
- Marketing campaign evaluation across synthetic buyer personas

### Tech Stack
- **Frontend:** Next.js, ShadCN, TailwindCSS
- **Backend:** Next.js
- **Models:** Nano Banana Pro, Gemini 3 Pro
- **Other:** Supabase, Cursor

### Setup Instructions
```bash
# How to run your project locally
pnpm install
pnpm run dev
```

### Screenshots
![1](/static/1.png)
![2](/static/2.png)
![3](/static/3.png)
![4](/static/4.png)
![5](/static/5.png)
![6](/static/6.png)

### Challenges We Faced
  - Prompt engineering Nano Banana Pro was relatively simple, but sometimes it was hard to articulate what I visually wanted

### What's Next
  - Simulating the worlds of your competitors
  - Creating a multiverse of worlds with different persona settings etc. so you can perform synthetic growth experiments

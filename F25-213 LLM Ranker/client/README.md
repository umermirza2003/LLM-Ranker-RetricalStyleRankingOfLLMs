# LLM-Ranker Frontend

A React + Vite + TailwindCSS + ShadCN UI frontend for the LLM-Ranker project.

## Features

- Clean, minimal grayscale UI matching the design
- Responsive layout for desktop and mobile
- Sidebar with AI model selection and chat history
- Search bar with query input
- Train and Results buttons
- Drag & drop file upload area
- Rankings panel showing ranked LLMs
- Smooth animations and transitions

## Setup

1. Run the setup commands:
```bash
npm create vite@latest . -- --template react
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install lucide-react
npm install clsx tailwind-merge
```

2. Start the development server:
```bash
npm run dev
```

## Project Structure

```
src/
├── components/
│   ├── ui/          # ShadCN-style UI components
│   ├── Sidebar.jsx  # Left sidebar with models and chats
│   ├── MainContent.jsx  # Main content area
│   ├── RankingsPanel.jsx  # Right rankings panel
│   ├── SearchBar.jsx
│   └── UploadBox.jsx
├── lib/
│   └── utils.js     # Utility functions
├── App.jsx          # Main app component
├── main.jsx         # Entry point
└── index.css        # Global styles
```

## Technologies

- React 18
- Vite
- TailwindCSS
- Lucide React (icons)
- ShadCN UI patterns


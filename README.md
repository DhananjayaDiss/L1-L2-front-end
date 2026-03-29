# Sri Lanka Telecom Help Desk Assistant

A modern, conversational frontend for interacting with an n8n-powered help desk assistant. This project is built using vanilla JavaScript and Vite, providing a seamless chat interface with agentic webhook streaming capabilities.

## Features

- **Conversational Interface**: A clean, responsive design tailored for chat interactions.
- **n8n Webhook Integration**: Connects seamlessly with n8n webhooks to initiate and resume workflows.
- **Real-time Processing**: Displays real-time loading statuses ("Processing...", "Calling AI agents...", etc.) and streams the chatbot response token-by-token.
- **Session Persistence**: Chat history and states are locally persisted in `localStorage`.
- **Customizable UI**: Includes an input bar, typing effect, and markdown formatting for rich text responses.
- **Glassmorphism Design**: Incorporates beautiful styling with dynamic loading animations and premium aesthetics.

## Technology Stack

- **Core**: HTML5, Vanilla JavaScript (ESModules)
- **Styling**: Vanilla CSS (Custom modern design with animations)
- **Build Tool**: Vite

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- npm or yarn

## Getting Started

Follow these instructions to set up and run the project locally.

### 1. Installation

Clone the repository and install the dependencies:

```bash
npm install
```

### 2. Configuration

Create a `.env` file in the root directory (you can use the provided `.env` structure as a reference) and configure your n8n webhook URLs:

```env
# The webhook URL that initiates a new conversation
VITE_WEBHOOK_START_URL=https://your-n8n-instance/webhook/chat-start

# The webhook URL used to resume the chat (e.g., after a Wait node)
VITE_WEBHOOK_RESUME_URL=https://your-n8n-instance/webhook/chat-resume
```

*Note: You can switch between n8n's `/webhook-test/` endpoints for development and `/webhook/` for production as needed.*

### 3. Running the Development Server

Start the local Vite development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port specified in your terminal).

### 4. Building for Production

To create a production-ready build:

```bash
npm run build
```

The compiled assets will be output to the `dist/` directory, which can then be deployed to any static hosting provider.

## Project Structure

- `src/main.js`: Application bootstrap and UI mounting.
- `src/config.js`: Centralized configuration for webhooks, UI behavior, and network timeout limits.
- `src/chat/`: Contains the controller and service logic for managing chat state and webhook communication.
- `src/ui/`: Contains the UI components (ChatWindow, InputBar, StatusBar, Header).
- `src/styles/`: Custom CSS files for styling the application.

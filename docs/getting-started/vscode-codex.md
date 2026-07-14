# Getting Started With VS Code And Codex

Use this route if you want the repository visible in an editor while the agent works.

## 1. Install The Tools

Install [Visual Studio Code](https://code.visualstudio.com/) and the [official Codex extension](https://marketplace.visualstudio.com/items?itemName=openai.chatgpt). OpenAI's current guide is [Codex IDE extension](https://developers.openai.com/codex/ide).

## 2. Download And Open The Project

Return to the top of the DiscoidalCapacitorBiasFilter GitHub repository page, select **Code**, and copy the HTTPS address. Use VS Code's **Clone Git Repository** command with that address:

```text
https://github.com/EricLarueMartin/DiscoidalCapacitorBiasFilter.git
```

Choose a project folder outside a live-sync service when practical, then open the cloned `DiscoidalCapacitorBiasFilter` folder. If you do not want to use Git, choose **Download ZIP** from GitHub's **Code** menu, extract it, and open the extracted folder in VS Code.

## 3. Start The Setup Task

Open Codex in VS Code, sign in, and send:

```text
Read README.md, AGENT.md, and deploy/pi/agent-setup.md. Walk me through setting up a Raspberry Pi for this project. Ask only for information you cannot discover yourself. Generate the SSH key yourself, and give me complete commands with all real values inserted whenever a manual step is required. Continue through deployment and testing, then give me a clickable link to the working site.
```

Keep the repository folder open while the task runs so the extension has the project context.

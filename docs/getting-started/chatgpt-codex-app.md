# Getting Started With The Codex Desktop App

This is the recommended human workflow for the project. The Codex desktop app can open a local folder, inspect files, run commands, and keep the Raspberry Pi setup in one task.

## 1. Install The App

Install the Codex desktop app and sign in with your ChatGPT account. Start with OpenAI's current [Codex setup page](https://openai.com/codex/get-started/).

## 2. Download The Project

Return to the top of the SHVBiasFilter GitHub repository page, above the README, and select **Code**.

If Git is installed, copy the HTTPS address shown there and clone it. For this repository, the command is:

```text
git clone https://github.com/EricLarueMartin/SHVBiasFilter.git
```

If you do not use Git, choose **Download ZIP** from the same **Code** menu and extract the downloaded file. Put the project in a normal folder outside OneDrive, iCloud Drive, or another live-sync service when practical because those services can interfere with Git's internal files.

## 3. Open It In Codex

In the desktop app, open the `SHVBiasFilter` folder as the working folder and start a Codex task. Send this prompt:

```text
Read README.md, AGENT.md, and deploy/pi/agent-setup.md. Walk me through setting up a Raspberry Pi for this project. Ask only for information you cannot discover yourself. Generate the SSH key yourself, and when I need to run a command manually, give me a complete command with the actual public key and values already inserted. Continue through deployment and testing, then give me a clickable link to the working site.
```

The agent should guide Raspberry Pi Imager and physical steps conversationally, then automate everything it can from your computer. Tell it when you need more or less detail.

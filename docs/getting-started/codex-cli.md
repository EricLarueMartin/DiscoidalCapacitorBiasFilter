# Getting Started With Codex CLI

This route keeps the setup in a terminal while giving Codex direct access to the local repository.

## 1. Install Codex

Follow OpenAI's current [Codex CLI guide](https://developers.openai.com/codex/cli), then run `codex` once and sign in with ChatGPT.

## 2. Download The Project

Return to the top of the SHVBiasFilter GitHub repository page, select **Code**, and copy the HTTPS address. In a terminal, clone the repository and enter it:

```text
git clone https://github.com/EricLarueMartin/SHVBiasFilter.git
cd SHVBiasFilter
```

If you do not want to use Git, choose **Download ZIP** from the same **Code** menu, extract it, and open a terminal in the extracted `SHVBiasFilter` folder. A project folder outside OneDrive, iCloud Drive, or another live-sync service is preferable.

## 3. Start The Setup Task

Run `codex` from the repository directory and send:

```text
Read README.md, AGENT.md, and deploy/pi/agent-setup.md. Walk me through setting up a Raspberry Pi for this project. Ask only for information you cannot discover yourself. Generate the SSH key yourself, and give me complete commands with all real values inserted whenever a manual step is required. Continue through deployment and testing, then give me a clickable link to the working site.
```

The agent should pause only for physical actions, account sign-in, network details, or commands that require your approval.

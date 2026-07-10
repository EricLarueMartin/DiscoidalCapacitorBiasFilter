# Getting Started With Claude Code

Claude Code can perform the same local-repository and SSH deployment workflow from a terminal.

## 1. Install Claude Code

Follow Anthropic's current [Claude Code setup guide](https://docs.anthropic.com/en/docs/claude-code/getting-started). It covers the currently supported installation paths for macOS, Linux, WSL, and Windows. Start `claude` once and complete authentication.

## 2. Download The Project

Return to the top of the SHVBiasFilter GitHub repository page, select **Code**, and copy the HTTPS address. In a terminal, clone the repository and enter it:

```text
git clone https://github.com/EricLarueMartin/SHVBiasFilter.git
cd SHVBiasFilter
```

If you do not want to use Git, choose **Download ZIP** from the same **Code** menu, extract it, and open a terminal in the extracted `SHVBiasFilter` folder. A project folder outside OneDrive, iCloud Drive, or another live-sync service is preferable.

## 3. Start The Setup Task

Run `claude` in the repository directory and send:

```text
Read README.md, AGENT.md, and deploy/pi/agent-setup.md. Walk me through setting up a Raspberry Pi for this project. Ask only for information you cannot discover yourself. Generate the SSH key yourself, and give me complete commands with all real values inserted whenever a manual step is required. Continue through deployment and testing, then give me a clickable link to the working site.
```

Approve only the file, terminal, network, and SSH access you are comfortable granting. Full unattended deployment requires the agent to run local SSH commands and administer the dedicated Pi account.

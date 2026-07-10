# Getting Started With Another Coding Agent

Any coding agent can set up this project if it can:

- Read and edit a local repository.
- Run terminal commands on your computer.
- Create and protect an SSH key pair.
- Connect to a Raspberry Pi over SSH.
- Request approval for privileged or network operations.
- Continue through installation, service setup, and smoke testing.

Return to the top of the SHVBiasFilter GitHub repository page and select **Code**. Either choose **Download ZIP** and extract it, or copy the HTTPS address and clone the repository:

```text
git clone https://github.com/EricLarueMartin/SHVBiasFilter.git
```

Open the resulting `SHVBiasFilter` folder as the agent's project or workspace. Then send:

```text
Read README.md, AGENT.md, and deploy/pi/agent-setup.md. Walk me through setting up a Raspberry Pi for this project. Ask only for information you cannot discover yourself. Generate the SSH key yourself, and when I need to run a command manually, give me a complete command with the actual public key and values already inserted. Continue through deployment and testing, then give me a clickable link to the working site.
```

If the tool cannot run commands or connect over SSH, it can still explain the process, but it cannot provide the mostly automated workflow for which this project was designed.

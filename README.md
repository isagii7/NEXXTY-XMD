# 🤖 NEXXTY-XMD

A Powerful, Multi-Device WhatsApp Bot Built with Baileys.

> **Note:** This bot is designed for easy deployment and management.

---

## 🚀 Deploy to Heroku

Click the button below to deploy this bot directly to Heroku.

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/isagii7/NEXXTY-XMD)

---

## 🔑 Get Your Session (Pair Code)

Before deploying, you need to generate a session ID. Click the button below to get your Pair Code.

[![Get Pair Code](https://img.shields.io/badge/GET%20PAIR%20CODE-📲-brightgreen?style=for-the-badge&logo=whatsapp)](https://sessionpair-217776e26ed6.herokuapp.com/#)

> **Instructions:**
> 1. Click the "Get Pair Code" button above.
> 2. Enter your WhatsApp number.
> 3. Copy the session ID or pair code generated.

---

## ⚙️ Configuration (Heroku Config Vars)

After clicking the Deploy button, Heroku will ask for these variables. Fill them carefully:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `SESSION_ID` | Your session ID from the Pair Code generator. | `KIRA-MD-xxxx...` |
| `OWNER_NUMBER` | Your WhatsApp number with country code. | `923001234567` |
| `BOT_NAME` | Name of your bot. | `NEXXTY-XMD` |
| `PREFIX` | Command prefix for the bot. | `.` |

---

## 📂 Manual Deployment

If you prefer manual deployment:

1.  **Fork** this repository.
2.  **Clone** your forked repo:
    ```bash
    git clone https://github.com/isagii7/NEXXTY-XMD.git
    ```
3.  **Install** dependencies:
    ```bash
    npm install
    ```
4.  **Create** a `.env` file and add your variables:
    ```
    SESSION_ID=your_session_id_here
    OWNER_NUMBER=your_number_here
    BOT_NAME=NEXXTY-XMD
    PREFIX=.
    ```
5.  **Start** the bot:
    ```bash
    npm start
    ```

---

## 💬 Support & Community

- **YouTube:** [Suprm_e](https://www.youtube.com/@Suprm_e...)
- **Repository:** [isagii7/NEXXTY-XMD](https://github.com/isagii7/NEXXTY-XMD)

> Made with ❤️ by the NEXXTY Team

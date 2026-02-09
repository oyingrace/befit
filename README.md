# BeFit

**BeFit** is an intelligent AI-powered workout assistant that combines **Agentic AI**, **RAG-enhanced knowledge**, and **MediaPipe pose detection** to create personalized workout routines and provide real-time form correction — designed for fitness enthusiasts at every level.

![Screenshot 2025-06-22 045702](https://github.com/user-attachments/assets/f68cb949-4dcd-406f-9eb3-c41e8b59f632)

![Screenshot 2025-06-22 054148](https://github.com/user-attachments/assets/25e6f9a0-e34b-4919-bab8-e94ba8065013)

![Screenshot 2025-06-22 045724](https://github.com/user-attachments/assets/8522c370-0f70-4646-a5e2-21fcc938d14d)

---

## 🚀 Core Features

### 🧠 **Agentic AI Workflow**
- **Intelligent Chat Assistant**: Natural language conversation for fitness advice and workout creation
- **Tool-Based Execution**: Uses specialized tools for workout generation, exercise config creation, and data persistence
- **Context-Aware Responses**: Maintains conversation flow with multi-step reasoning
- **User Session Management**: Personalized experience with login/logout functionality

### 🎯 **Dynamic Workout Generation**
- **Personalized Routines**: AI creates workouts based on goals, equipment, experience level, and duration
- **Unlimited Exercise Support**: No longer limited to predefined exercises - AI generates tracking configs for any exercise
- **Automatic Exercise Config Generation**: MediaPipe pose tracking configurations created dynamically using LLM analysis
- **Smart Caching**: Efficient reuse of generated configurations for performance
- **Database Integration**: Saves workouts with linked exercise configurations for future use

### 📚 **RAG-Enhanced Knowledge System**
- **Vector Database**: Qdrant-powered embedding storage of exercise science research
- **Relevance Filtering**: Only uses high-relevance content (70%+ similarity) for responses
- **Evidence-Based Recommendations**: Leverages latest research in biomechanics, anatomy, and exercise science
- **Source Citation**: References specific research sources in responses
- **OpenRouter Integration**: Cloud-based LLM and embedding generation via OpenRouter API

### 📷 **Advanced Pose Detection & Analysis**
- **MediaPipe Integration**: Real-time pose landmark detection via webcam
- **Multi-Joint Tracking**: Composite angle analysis from multiple body joints
- **Adaptive Peak Detection**: Intelligent rep counting with trend analysis
- **Target Angle Guidance**: ROM (Range of Motion) optimization with personalized targets
- **Bilateral Tracking**: Left and right side angle measurements for balanced analysis

### ✅ **Intelligent Real-Time Feedback**
- **AI-Powered Analysis**: LLM-based feedback generation considering form, tempo, and ROM
- **Configurable Performance Modes**:
  - **Fast Mode**: Quick text feedback for immediate responsiveness
  - **Enhanced Reference**: RAG-enhanced feedback with research backing
  - **Voice Feedback**: Spoken guidance in Bengali for hands-free operation
  - **Combined Mode**: Both enhanced reference and voice for comprehensive feedback
- **Scoring System**: 0-100 performance scores with "good/okay/bad" classifications
- **Progressive ROM Targets**: Adjustable range of motion goals (Low/Standard/High/Maximum)

### 🛠️ **User Interface & Experience**
- **Modern SvelteKit Frontend**: Built with shadcn/ui components for a clean, responsive design
- **Dashboard Overview**: Centralized view of workouts, progress, and AI interactions
- **Exercise Config Management**: Visual interface for viewing and testing generated configurations
- **Form Analysis Page**: Real-time pose detection with visual feedback
- **Workout Library**: Save, organize, and access personalized workout routines
- **Mobile-Responsive**: Works seamlessly across desktop and mobile devices

---

## 🤖 Agentic AI Workflow

BeFit implements a sophisticated agentic AI system that orchestrates multiple tools and knowledge sources to provide comprehensive fitness assistance:
![Editor _ Mermaid Chart-2025-06-22-011233](https://github.com/user-attachments/assets/ccda9128-e5f2-4045-a161-aae3a73deae6)


### Agentic Components:

1. **Query Analysis Agent**: Determines if queries are fitness-related and routes appropriately
2. **RAG Retrieval Agent**: Searches vector database for relevant exercise science research
3. **Workout Generation Agent**: Creates personalized routines using evidence-based principles
4. **Exercise Config Agent**: Generates MediaPipe configurations for any exercise dynamically
5. **Persistence Agent**: Manages user data, workout storage, and exercise configurations
6. **Feedback Agent**: Provides real-time form analysis using pose detection data

---

## �️ Tech Stack

### **Frontend & UI**
- **SvelteKit**: Modern web framework with server-side rendering
- **shadcn/ui**: Beautiful, accessible component library built on Radix UI
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **TypeScript**: Type-safe development with enhanced developer experience

### **AI & Machine Learning**
- **Vercel AI SDK**: Agentic framework for tool-based AI interactions
- **OpenRouter**: Unified API for accessing multiple LLM providers (OpenAI, Anthropic, Qwen, etc.)
- **MediaPipe**: Google's pose detection and landmark tracking
- **OpenAI-Compatible API**: Flexible model integration

### **Data & Storage**
- **PostgreSQL**: Primary database via Prisma ORM
- **Qdrant**: Vector database for RAG embeddings
- **Prisma**: Type-safe database client and migration tool
- **Better Auth**: Secure authentication and session management

### **Infrastructure**
- **SvelteKit API Routes**: Backend API endpoints
- **Docker**: Containerized Qdrant deployment
- **pnpm**: Fast, disk space efficient package manager

---

## 🔍 How It Works

### **Workout Creation Flow**
1. **User Input** → Express fitness goals, available equipment, and experience level
2. **AI Analysis** → Agent analyzes requirements and queries RAG system for evidence-based recommendations
3. **Workout Generation** → AI crafts personalized plan with exercises, sets, reps, and rest periods
4. **Exercise Config Creation** → Automatically generates MediaPipe tracking configurations for each exercise
5. **Database Storage** → Saves complete workout with linked exercise configurations
6. **Real-Time Tracking** → Use saved workouts for live pose detection and form feedback

### **Real-Time Form Analysis**
1. **Camera Activation** → MediaPipe detects 33 body landmarks in real-time
2. **Angle Calculation** → Multi-joint composite signals track movement patterns
3. **Rep Detection** → Advanced peak/valley detection counts repetitions automatically
4. **AI Feedback** → LLM analyzes form, tempo, and ROM providing instant corrections
5. **Voice Guidance** → Optional spoken feedback in Bengali for hands-free operation

### **Dynamic Exercise Support**
1. **Exercise Recognition** → User mentions any exercise name
2. **Biomechanical Analysis** → AI determines movement patterns, key joints, and muscle groups
3. **Config Generation** → Creates MediaPipe tracking configuration automatically
4. **Caching** → Stores configs for future use and performance optimization

---

## 📦 Installation & Setup

### **Prerequisites**
- Node.js 18+ and pnpm
- Docker (for Qdrant vector database)
- OpenRouter API key (get one at https://openrouter.ai)
- Webcam for pose detection

### **1. Clone and Install**
```bash
git clone https://github.com/WhyAsh5114/fit-wise
cd fit-wise
pnpm install
```

### **2. Database Setup**
```bash
# Start Qdrant vector database
docker run -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant

# Set up PostgreSQL (update .env with your DATABASE_URL)
pnpm prisma migrate dev
```

### **3. OpenRouter API Setup**
1. Sign up for an account at [OpenRouter](https://openrouter.ai)
2. Get your API key from the [Keys page](https://openrouter.ai/keys)
3. (Optional) Add credits to your account if you want to use paid models

### **4. Environment Variables**
Create `.env` file:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/fitwise"
OPENROUTER_API_KEY="sk-or-v1-..." # Your OpenRouter API key
CHAT_MODEL="qwen/qwen-2.5-7b-instruct:free" # Free model, or use any OpenRouter model
EMBEDDING_MODEL="openai/text-embedding-ada-002" # Embedding model
QDRANT_URL="http://localhost:6333"
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="http://localhost:5173"
```

**Model Options:**
- **Free Chat Models**: `qwen/qwen-2.5-7b-instruct:free`, `meta-llama/llama-3.2-3b-instruct:free`
- **Paid Chat Models**: `openai/gpt-4o-mini`, `anthropic/claude-3.5-sonnet`, `qwen/qwen-2.5-72b-instruct`
- **Embedding Models**: `openai/text-embedding-ada-002`, `openai/text-embedding-3-small`

### **5. Start Development**
```bash
pnpm dev
```

> ⚠️ **Requirements**: Webcam access and modern browser for pose detection. Ensure OpenRouter API key is configured for AI features.

---

## 🎯 Key Features Demo

### **Chat-Based Workout Creation**
```
User: "Create a upper body workout for intermediate level with dumbbells"
AI: *Uses createWorkout tool to generate personalized routine*
AI: "Would you like me to save this workout to your profile?"
User: "Yes"
AI: *Uses saveWorkout tool and generates exercise configs*
```

### **Dynamic Exercise Configuration**
```
User: "Can you track tricep dips?"
AI: *Uses generateExerciseConfig tool*
AI: "Generated tracking configuration for tricep dips with elbow angle monitoring"
```

### **Real-Time Form Feedback**
- **Visual**: Live pose landmarks with angle measurements
- **Text**: "Great range of motion! Control the tempo more." (Score: 82/100)
- **Voice**: Bengali audio feedback for hands-free guidance
- **Classification**: Good/Okay/Bad with specific improvement suggestions

---

## 🧩 Roadmap & Current Status

### ✅ **Completed Features**
- [x] Agentic AI chat interface with tool-based execution
- [x] Dynamic exercise configuration generation for unlimited exercise support
- [x] RAG-enhanced knowledge system with vector database
- [x] Real-time MediaPipe pose detection and rep counting
- [x] AI-powered form feedback with scoring system
- [x] Target angle guidance with progressive ROM settings
- [x] Workout creation, saving, and management
- [x] Exercise config caching and performance optimization
- [x] User authentication and session management
- [x] Modern responsive UI with SvelteKit and shadcn/ui

### 🚧 **In Development**
- [ ] Voice assistant guidance expansion (currently Bengali only)
- [ ] Mobile app with offline-first PWA capabilities
- [ ] Advanced workout analytics and progress tracking
- [ ] Social features and workout sharing
- [ ] Integration with health platforms (Apple Health, Google Fit)

### 🎯 **Future Enhancements**
- [ ] Computer vision-based equipment detection
- [ ] AI-powered injury prevention and recovery protocols
- [ ] Personalized nutrition recommendations
- [ ] Virtual reality workout environments
- [ ] Multi-language voice feedback support
- [ ] Professional trainer dashboard and client management

---

## 🚧 Challenges I Ran Into

Building BeFit presented several unique technical challenges that required innovative solutions:

### **MediaPipe Angle Data Preprocessing**
Transforming raw MediaPipe pose landmarks into meaningful angle data for LLM consumption was more complex than anticipated. The challenge involved:
- **Noisy Landmark Data**: MediaPipe outputs can be jittery, requiring sophisticated smoothing algorithms
- **Multi-Joint Coordination**: Creating composite angle signals from multiple body joints while maintaining biomechanical accuracy
- **Peak Detection Logic**: Developing adaptive algorithms to detect rep peaks/valleys across different exercise patterns
- **Angle Normalization**: Ensuring angle data is consistent and interpretable for downstream LLM analysis

**Solution**: Implemented weighted composite angle calculations with moving average smoothing and adaptive peak detection that considers exercise-specific movement patterns.

### **Real-Time Model Streaming with Minimal Latency**
Achieving fast response times while coordinating multiple AI models (LLM, RAG, TTS) proved challenging:
- **RAG Pipeline Bottleneck**: Vector search in Qdrant + embedding generation + LLM processing created latency spikes
- **Streaming Conflicts**: Balancing real-time pose feedback with chat-based AI responses
- **Memory Management**: Local models consuming significant RAM while maintaining smooth pose detection
- **Tool Coordination**: Managing sequential tool calls without blocking the UI

**Solution**: Implemented relevance thresholding (70%+) for RAG, aggressive caching of exercise configs, and background streaming with tool call optimization.

### **Quality Data Scraping for RAG Embeddings**
Building a robust knowledge base from exercise science content required careful data curation:
- **Content Quality**: Filtering scientific articles from fitness blog spam and misinformation
- **Source Diversity**: Balancing peer-reviewed research with practical training insights
- **Embedding Consistency**: Ensuring local embedding models produce meaningful vector representations
- **Data Structure**: Organizing scraped content for optimal retrieval performance

**Solution**: Focused on reputable sources (RPStrength, research papers), implemented content validation, and used proven embedding models like `all-MiniLM-L6-v2`.

### **Local Model Quality vs. Speed Trade-offs**
Running everything locally for privacy while maintaining performance created difficult compromises:
- **Model Size Limitations**: Smaller models (3B-4B parameters) vs. quality of larger cloud models
- **Hardware Constraints**: Balancing LLM inference, embedding generation, and MediaPipe processing on consumer hardware
- **Response Quality**: Local models sometimes producing less nuanced feedback compared to GPT-4 class models
- **Context Length**: Smaller models struggling with long conversation history and complex RAG context

**Solution**: Chose `qwen3-4b` for good instruction following, implemented smart context truncation, and optimized prompts for smaller model capabilities while maintaining acceptable quality.

---

## � Documentation

- **[AI Feedback Setup](docs/AI_FEEDBACK_SETUP.md)**: Configure Ollama and LM Studio for feedback
- **[Dynamic Exercise Config](docs/DYNAMIC_EXERCISE_CONFIG.md)**: Understanding the exercise generation system
- **[Target Angles Implementation](TARGET_ANGLES_IMPLEMENTATION.md)**: ROM guidance and target angle features
- **[Embedding Service](embedding/README.md)**: RAG system setup and content scraping

---

## 🚀 Deployment

**Deploying to Vercel or other platforms?** See the **[Deployment Guide](DEPLOYMENT.md)** for detailed instructions on:
- Deploying to Vercel (or similar platforms)
- Setting up Qdrant Cloud (managed vector database)
- Alternative hosting options for Qdrant
- Environment variable configuration
- Database migration strategies

> **Note**: Vercel doesn't support Docker containers. For production deployments, use **Qdrant Cloud** (recommended) or deploy Qdrant separately on platforms like Railway, Render, or Fly.io.

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request`

### **Areas for Contribution**
- Exercise science research integration
- New MediaPipe pose tracking configurations
- UI/UX improvements and accessibility
- Mobile app development
- Additional language support for voice feedback
- Performance optimizations

---

## � License

BeFit is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

## 💬 Support & Community

- **Issues**: [GitHub Issues](https://github.com/WhyAsh5114/fit-wise/issues)
- **Discussions**: [GitHub Discussions](https://github.com/WhyAsh5114/fit-wise/discussions)
- **Email**: For direct support and collaboration inquiries

---

## 🌟 Acknowledgments

- **MediaPipe Team**: For excellent pose detection technology
- **Research Papers**: Exercise science and biomechanics research powering our RAG system
- **Open Source Community**: SvelteKit, Prisma, Qdrant, and other amazing tools
- **Fitness Community**: Feedback and testing from real users and trainers

---

*Built with ❤️ for the fitness community. Transform your workouts with AI-powered intelligence.*

**Transform your fitness journey with smart, real-time guidance — FitWise.**

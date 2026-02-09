# AI Workout Feedback Setup

This document explains how to set up and use the AI-powered workout feedback system.

## Prerequisites

1. **Ollama** - Local AI model runner
2. **A compatible language model** - We recommend `llama3.2:3b` for good performance

## Setup Instructions

### 1. Install Ollama

**macOS/Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from https://ollama.ai/download

### 2. Pull the Required Model

```bash
ollama pull llama3.2:3b
```

### 3. Start Ollama Server

```bash
ollama serve
```

The server will run on `http://localhost:11434`

### 4. Verify Installation

Test that Ollama is working:
```bash
curl http://localhost:11434/api/tags
```

## API Endpoint

### POST `/api/feedback`

Generates AI-powered feedback for workout repetitions.

#### Input Schema (JSON):
```typescript
{
  exerciseName: string,
  repNumber: number,
  duration: number,        // in milliseconds
  angleRange: {
    min: number,          // in degrees
    max: number          // in degrees
  },
  averageAngle: number,   // in degrees
  rangeOfMotion: number   // in degrees
}
```

#### Output Schema (JSON):
```typescript
{
  feedback: string,       // Max 50 characters
  score: number,         // 0-100
  classification: "good" | "okay" | "bad"
}
```

#### Example Request:
```bash
curl -X POST http://localhost:5173/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "exerciseName": "bicep curl",
    "repNumber": 1,
    "duration": 1200,
    "angleRange": { "min": 45.2, "max": 135.8 },
    "averageAngle": 90.5,
    "rangeOfMotion": 90.6
  }'
```

#### Example Response:
```json
{
  "feedback": "Great range of motion! Control the tempo more.",
  "score": 82,
  "classification": "good"
}
```

## Scoring Criteria

The AI evaluates based on:

1. **Range of Motion** (40% weight)
   - Exercise-specific optimal ranges
   - Bicep curls: ~45-135°
   - Squats: ~90-180° (knee angle)
   - Push-ups: ~90-180° (elbow angle)

2. **Duration/Tempo** (35% weight)
   - Controlled movement timing
   - Bicep curls: 1-2 seconds
   - Squats: 2-3 seconds
   - Push-ups: 1-2 seconds

3. **Consistency** (25% weight)
   - Smooth, controlled movement
   - Proper angle progression

## Classification Ranges

- **Good** (80-100): Excellent form, minor or no improvements needed
- **Okay** (60-79): Good form with some areas for improvement
- **Bad** (0-59): Poor form, significant improvements needed

## Troubleshooting

### Ollama Not Running
- Ensure Ollama is installed and running: `ollama serve`
- Check the service is accessible: `curl http://localhost:11434/api/tags`

### Model Not Found
- Pull the required model: `ollama pull llama3.2:3b`
- Update the model name in `/src/routes/api/feedback/+server.ts` if using a different model

### API Errors
- Check browser developer console for detailed error messages
- Verify input data matches the expected schema
- Ensure Ollama is running and accessible

## Customization

### Using a Different Model

Edit `/src/routes/api/feedback/+server.ts`:

```typescript
const model = ollama('your-model-name'); // Replace with your preferred model
```

### Modifying Feedback Criteria

Update the prompt in the same file to adjust how the AI evaluates exercises.

### Adding New Exercises

Add exercise-specific criteria to the prompt template in the API endpoint.

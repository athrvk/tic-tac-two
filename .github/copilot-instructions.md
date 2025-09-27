# Copilot Instructions for Tic-Tac-Two

## Project Overview

Tic-Tac-Two is a modern twist on the classic Tic-Tac-Toe game with unique mechanics where only the last 6 moves remain on the board, creating dynamic gameplay strategies. The application is built with a Java Spring Boot backend and React frontend, deployed on Render.

## Architecture

### Tech Stack
- **Backend**: Java 17, Spring Boot 2.7.5, Maven, WebSocket support
- **Frontend**: React 18, styled-components, npm
- **Deployment**: Docker, Render platform
- **Communication**: WebSocket for real-time multiplayer gameplay

### Project Structure
```
tic-tac-two/
├── backend/               # Java Spring Boot application
│   ├── src/main/java/com/game/
│   │   ├── TicTacTwoApplication.java    # Main Spring Boot application
│   │   ├── config/                      # Configuration classes
│   │   ├── controller/                  # REST and WebSocket controllers
│   │   ├── model/                       # Game state and data models
│   │   └── service/                     # Business logic services
│   └── pom.xml           # Maven dependencies
├── frontend/             # React application
│   ├── src/
│   │   ├── App.js        # Main React component
│   │   ├── components/   # Reusable UI components
│   │   │   ├── Game/     # Game-specific components
│   │   │   └── UI/       # General UI components
│   │   ├── styles/       # Theme and global styles
│   │   └── utils/        # Helper functions and WebSocket utilities
│   └── package.json      # npm dependencies
├── Dockerfile            # Multi-stage build for production
└── docker-compose.yml    # Local development setup
```

## Development Guidelines

### Code Style and Standards

#### Java Backend
- Use Spring Boot conventions and annotations
- Follow standard Java naming conventions (camelCase for methods/variables, PascalCase for classes)
- Use `@Service`, `@Controller`, `@Configuration` annotations appropriately
- Implement proper logging with SLF4J
- Use concurrent data structures for thread-safe operations (e.g., `ConcurrentHashMap`)
- Handle WebSocket connections and messaging properly

#### React Frontend
- Use functional components with React Hooks
- Implement styled-components for CSS-in-JS styling
- Follow the established theme system in `src/styles/theme.js`
- Use the existing color palette designed for high contrast and e-ink display compatibility
- Maintain consistent spacing using theme values
- Components should be responsive and mobile-friendly

#### Styling Guidelines
- High contrast design for accessibility and e-ink displays
- Colors: Black (#000000) primary, light gray (#f6f6f6) background, medium grays for interactive elements
- Typography: Georgia serif font for better readability
- Consistent spacing using theme spacing values (xs: 0.25rem, sm: 0.5rem, md: 1rem, lg: 2rem)
- Clean, minimalist interface with centered layout
- Responsive design that works on mobile and desktop

### Game Logic Requirements
- Only the last 6 moves remain visible on the board
- Session-based player assignment (X or O)
- Real-time multiplayer using WebSocket connections
- Proper game state management across client and server
- Winner detection considering the dynamic board state

### Build and Test Commands

#### Backend (from /backend directory)
```bash
# Install dependencies and compile
mvn clean compile

# Run tests
mvn test

# Build JAR
mvn clean package

# Run locally
mvn spring-boot:run
```

#### Frontend (from /frontend directory)
```bash
# Install dependencies
npm install

# Start development server
npm start

# Run tests
npm test

# Build for production
npm run build

# Build and copy to backend static resources
npm run prebuildlocal && npm run buildlocal
```

#### Full Application
```bash
# Build and run with Docker
docker-compose up --build

# Build production image
docker build -t tic-tac-two .

# Run with Docker (exposes port 8080)
docker run -p 8080:8080 tic-tac-two
```

### Development Workflow
1. Backend runs on port 8080 locally (${PORT:8080}), 10000 in production
2. Frontend development server runs on port 3000
3. WebSocket connections handle real-time game updates
4. Static frontend assets are served by Spring Boot in production
5. Environment-specific configuration via `application.properties` and `application-prod.properties`

### Key Components to Understand

#### Backend Services
- `GameService`: Manages room creation, player joining, and game state
- `GameController`: Handles WebSocket messaging for real-time gameplay
- `HTTPController`: Provides REST endpoints for room management

#### Frontend Components
- `App.js`: Main application logic and state management
- `Board`: Game board rendering and interaction
- `Header`: Application header with game title and user info
- Theme system for consistent styling across components

### WebSocket Integration
- Real-time communication between players
- Room-based game sessions
- Automatic player symbol assignment
- Game state synchronization

### Deployment Notes
- Application is deployed on Render platform
- Multi-stage Docker build for optimization
- Frontend assets are served by Spring Boot backend
- No database required - uses in-memory storage for game sessions
- Production port: 10000, Development port: 8080
- CORS configured with ALLOWED_ORIGINS environment variable

### Testing
- Currently no custom test suites implemented
- Frontend supports React testing framework via `npm test`
- Backend supports JUnit testing via `mvn test`
- Consider adding unit tests for game logic and integration tests for WebSocket communication

### Security Considerations
- No sensitive data stored permanently
- Session-based game rooms with automatic cleanup
- CORS configured for frontend-backend communication

## When Making Changes
- Test both frontend and backend components
- Ensure WebSocket functionality works correctly
- Verify responsive design on different screen sizes
- Maintain the established theme and styling patterns
- Consider the unique game mechanics when modifying game logic
- Test multiplayer functionality with multiple browser sessions
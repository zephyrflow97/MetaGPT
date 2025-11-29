#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Project Templates for MGX Clone
Provides predefined project templates for quick start
"""
from typing import Optional

# 项目模板定义
PROJECT_TEMPLATES = {
    "react_app": {
        "id": "react_app",
        "name": "React App",
        "description": "Modern React application with TypeScript and Tailwind CSS",
        "icon": "⚛️",
        "category": "frontend",
        "prompt_template": """Create a modern React application with the following specifications:

Project Name: {project_name}

Requirements:
- Use React 18+ with TypeScript
- Use Tailwind CSS for styling
- Include responsive design
- Create a clean, modern UI
- Include proper component structure

Features to implement:
{features}

Additional requirements:
- Use functional components with hooks
- Include proper error handling
- Add loading states where appropriate
- Use semantic HTML
""",
        "default_features": [
            "Home page with hero section",
            "Navigation bar with responsive mobile menu",
            "Footer with links",
        ],
        "suggested_features": [
            "Dark mode toggle",
            "Contact form",
            "Image gallery",
            "Blog section",
            "About page",
        ],
    },
    "vue_app": {
        "id": "vue_app",
        "name": "Vue App",
        "description": "Vue 3 application with Composition API",
        "icon": "💚",
        "category": "frontend",
        "prompt_template": """Create a Vue 3 application with the following specifications:

Project Name: {project_name}

Requirements:
- Use Vue 3 with Composition API
- Use TypeScript for type safety
- Use Vue Router for navigation
- Include Pinia for state management
- Use CSS or Tailwind for styling

Features to implement:
{features}

Additional requirements:
- Use modern Vue 3 best practices
- Include proper component structure
- Add transitions and animations
""",
        "default_features": [
            "Home page",
            "Navigation component",
            "Footer component",
        ],
        "suggested_features": [
            "User authentication flow",
            "Dashboard page",
            "Settings page",
            "Data table component",
        ],
    },
    "api_service": {
        "id": "api_service",
        "name": "REST API Service",
        "description": "FastAPI backend with SQLite database",
        "icon": "🚀",
        "category": "backend",
        "prompt_template": """Create a REST API service with the following specifications:

Project Name: {project_name}

Requirements:
- Use Python with FastAPI framework
- Use SQLite with SQLAlchemy for database
- Include Pydantic for data validation
- Add proper error handling
- Include CORS middleware

API endpoints to implement:
{features}

Additional requirements:
- Follow RESTful API conventions
- Include proper HTTP status codes
- Add API documentation with Swagger
- Include input validation
""",
        "default_features": [
            "CRUD operations for main resource",
            "Health check endpoint",
            "List with pagination",
        ],
        "suggested_features": [
            "User authentication",
            "JWT token support",
            "Rate limiting",
            "Logging middleware",
            "Database migrations",
        ],
    },
    "game": {
        "id": "game",
        "name": "Web Game",
        "description": "Interactive browser-based game",
        "icon": "🎮",
        "category": "game",
        "prompt_template": """Create an interactive web game with the following specifications:

Project Name: {project_name}

Requirements:
- Use vanilla JavaScript or TypeScript
- Use HTML5 Canvas or DOM-based rendering
- Include responsive design that works on desktop and mobile
- Add smooth animations
- Include sound effects (optional)

Game features to implement:
{features}

Additional requirements:
- Include a start screen
- Add score tracking
- Include game over screen with restart option
- Save high scores to local storage
""",
        "default_features": [
            "Core game mechanics",
            "Score display",
            "Game over handling",
        ],
        "suggested_features": [
            "Multiple difficulty levels",
            "Leaderboard",
            "Sound toggle",
            "Pause functionality",
            "Tutorial/instructions",
        ],
    },
    "dashboard": {
        "id": "dashboard",
        "name": "Admin Dashboard",
        "description": "Data visualization and management dashboard",
        "icon": "📊",
        "category": "frontend",
        "prompt_template": """Create an admin dashboard with the following specifications:

Project Name: {project_name}

Requirements:
- Modern, clean UI design
- Use charts and data visualization (Chart.js or similar)
- Responsive layout for all screen sizes
- Sidebar navigation
- Dark/light theme support

Dashboard features:
{features}

Additional requirements:
- Use a consistent color scheme
- Include loading states
- Add hover effects and transitions
- Include data tables with sorting
""",
        "default_features": [
            "Overview cards with key metrics",
            "Main data chart",
            "Recent activity list",
        ],
        "suggested_features": [
            "User management table",
            "Export data functionality",
            "Date range filter",
            "Notification system",
            "Settings panel",
        ],
    },
    "landing_page": {
        "id": "landing_page",
        "name": "Landing Page",
        "description": "Marketing landing page with modern design",
        "icon": "🎯",
        "category": "frontend",
        "prompt_template": """Create a marketing landing page with the following specifications:

Project Name: {project_name}

Requirements:
- Modern, eye-catching design
- Fully responsive (mobile-first)
- Smooth scroll animations
- Fast loading performance
- SEO-friendly structure

Sections to include:
{features}

Additional requirements:
- Use engaging copy placeholders
- Include call-to-action buttons
- Add social proof elements
- Include contact/signup form
""",
        "default_features": [
            "Hero section with CTA",
            "Features section",
            "Footer with links",
        ],
        "suggested_features": [
            "Testimonials carousel",
            "Pricing table",
            "FAQ accordion",
            "Team section",
            "Newsletter signup",
        ],
    },
    "portfolio": {
        "id": "portfolio",
        "name": "Portfolio Website",
        "description": "Personal portfolio to showcase work",
        "icon": "💼",
        "category": "frontend",
        "prompt_template": """Create a personal portfolio website with the following specifications:

Project Name: {project_name}

Requirements:
- Clean, professional design
- Responsive layout
- Smooth animations and transitions
- Easy to customize

Sections to include:
{features}

Additional requirements:
- Include placeholder content
- Add project cards with hover effects
- Include contact form
- Add social media links
""",
        "default_features": [
            "Hero/intro section",
            "Projects gallery",
            "Contact section",
        ],
        "suggested_features": [
            "About me section",
            "Skills section with progress bars",
            "Blog section",
            "Resume download",
            "Testimonials",
        ],
    },
    "ecommerce": {
        "id": "ecommerce",
        "name": "E-Commerce Store",
        "description": "Online store with product listings and cart",
        "icon": "🛒",
        "category": "fullstack",
        "prompt_template": """Create an e-commerce store interface with the following specifications:

Project Name: {project_name}

Requirements:
- Modern, clean UI design
- Product grid with filtering
- Shopping cart functionality
- Responsive design
- Local storage for cart persistence

Features to implement:
{features}

Additional requirements:
- Use proper component structure
- Include loading states
- Add product search
- Include price formatting
""",
        "default_features": [
            "Product listing page",
            "Shopping cart",
            "Product detail view",
        ],
        "suggested_features": [
            "Product categories",
            "Wishlist",
            "Checkout flow",
            "Order history",
            "User reviews",
        ],
    },
}

# 模板分类
TEMPLATE_CATEGORIES = {
    "frontend": {"name": "Frontend", "icon": "🎨", "description": "Web frontend applications"},
    "backend": {"name": "Backend", "icon": "⚙️", "description": "Server-side applications"},
    "fullstack": {"name": "Full Stack", "icon": "🔄", "description": "Complete web applications"},
    "game": {"name": "Games", "icon": "🎮", "description": "Interactive web games"},
}


def get_all_templates() -> list[dict]:
    """Get all available templates"""
    return list(PROJECT_TEMPLATES.values())


def get_template(template_id: str) -> Optional[dict]:
    """Get a specific template by ID"""
    return PROJECT_TEMPLATES.get(template_id)


def get_templates_by_category(category: str) -> list[dict]:
    """Get templates filtered by category"""
    return [t for t in PROJECT_TEMPLATES.values() if t["category"] == category]


def get_categories() -> list[dict]:
    """Get all template categories"""
    return [{"id": k, **v} for k, v in TEMPLATE_CATEGORIES.items()]


def generate_prompt_from_template(
    template_id: str,
    project_name: str,
    selected_features: Optional[list[str]] = None,
    custom_requirements: Optional[str] = None,
) -> str:
    """
    Generate a complete prompt from template
    
    Args:
        template_id: The template ID
        project_name: Name for the project
        selected_features: List of features to include
        custom_requirements: Additional custom requirements
        
    Returns:
        Complete prompt string
    """
    template = get_template(template_id)
    if not template:
        return ""
    
    # Use selected features or default features
    features = selected_features or template.get("default_features", [])
    features_text = "\n".join(f"- {f}" for f in features)
    
    # Generate base prompt
    prompt = template["prompt_template"].format(
        project_name=project_name or "My Project",
        features=features_text,
    )
    
    # Add custom requirements if provided
    if custom_requirements:
        prompt += f"\n\nAdditional User Requirements:\n{custom_requirements}"
    
    return prompt


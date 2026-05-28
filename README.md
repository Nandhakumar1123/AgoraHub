# AgoraHub (Civix)

<p align="center">
  <img src="Results/Front_Page.jpeg" width="1000">
</p>

<p align="center">
  <h2>AI-Powered Community Governance Platform</h2>
</p>

AgoraHub is a unified digital platform developed to improve and simplify community governance in environments such as hostels, apartments, campuses, and clubs. The platform replaces traditional communication methods such as notice boards, paper-based complaints, and scattered messaging groups with a centralized and intelligent digital ecosystem.

AgoraHub combines:

* Real-time communication
* Complaint and petition management
* Voting and polling systems
* Community announcements
* Event coordination
* AI-powered assistance
* Secure role-based governance

The system integrates Large Language Models (LLMs) with Retrieval-Augmented Generation (RAG) to provide intelligent, context-aware assistance using community-specific information.

---

# Front Page

<p align="center">
  <img src="Results/Front_Page.jpeg" width="950">
</p>

The front page serves as the primary entry point into the AgoraHub platform. It introduces users to the core functionalities of the system and provides access to registration, login, and community services.

The interface is designed with simplicity and accessibility in mind to encourage active community participation and improve user engagement.

Main purposes:

* User onboarding
* Platform introduction
* Secure authentication access
* Easy navigation to community features

---

# Community Creation Module

<p align="center">
  <img src="Results/Community Creation.jpeg" width="950">
</p>

The Community Creation Module enables Heads or Administrators to create digital community spaces such as hostels, apartments, campuses, and clubs. Each community is assigned a unique invite code that members can use to join securely.

This module helps establish structured governance and ensures that communication and activities remain organized within individual communities.

Functions:

* Community creation
* Invite code generation
* Community customization
* Feature activation
* Access management

---

# Community Dashboard

<p align="center">
  <img src="Results/Community_screen.jpeg" width="950">
</p>

The Community Dashboard acts as the central workspace for all users within a selected community. It provides quick access to announcements, complaints, petitions, events, voting systems, and chat functionalities.

The dashboard improves:

* Information accessibility
* Community coordination
* Transparency
* User interaction
* Administrative monitoring

---

# AI Chat Interface

<p align="center">
  <img src="Results/AI_CHAT.jpeg" width="950">
</p>

The AI Chat Interface provides intelligent and context-aware assistance using Large Language Models (LLMs) integrated with Retrieval-Augmented Generation (RAG).

Instead of generating generic responses, the AI retrieves relevant community-specific documents and combines them with user queries to produce accurate and meaningful answers.

Capabilities include:

* Community question answering
* Rule clarification
* Event information
* AI-guided support
* Multilingual assistance

---

# Complaint AI Module

<p align="center">
  <img src="Results/AI_COMPLAINT.jpeg" width="950">
</p>

The Complaint AI module assists users in drafting, analyzing, and summarizing complaints submitted within the community. It applies Natural Language Processing (NLP) techniques such as sentiment analysis and toxicity detection to improve moderation and issue prioritization.

This module supports:

* Complaint summarization
* Toxicity analysis
* Sentiment detection
* AI-generated recommendations
* Administrative assistance

---

# Petition AI Module

<p align="center">
  <img src="Results/PETITION_AI.jpeg" width="950">
</p>

The Petition AI module helps users create structured petitions and assists administrators in reviewing requests efficiently.

The AI system can:

* Analyze petition intent
* Generate summaries
* Suggest wording improvements
* Support review workflows
* Improve administrative transparency

---

# Complaint Dashboard

<p align="center">
  <img src="Results/AI_COMPLAINT_dashboard.jpeg" width="950">
</p>

The Complaint Dashboard displays all submitted complaints along with categories, severity levels, and status information.

Administrators can:

* Review complaints
* Update statuses
* Resolve issues
* Monitor complaint trends
* Maintain accountability

This structured workflow ensures transparency and organized issue resolution.

---

# Petition Dashboard

<p align="center">
  <img src="Results/petition_dashboard.jpeg" width="950">
</p>

The Petition Dashboard provides a centralized interface for managing all community petitions.

Members can track petition progress while administrators review, approve, or reject requests systematically.

Benefits:

* Organized governance
* Better participation
* Transparent workflows
* Efficient petition tracking

---

# Raise Complaint Module

<p align="center">
  <img src="Results/raise_complaint.jpeg" width="950">
</p>

This module allows members to submit complaints regarding infrastructure, safety, maintenance, or community-related issues.

Each complaint contains:

* Complaint title
* Description
* Severity level
* Category
* Submission date
* Current status

The module transforms informal complaints into structured governance records.

---

# Petition Form Module

<p align="center">
  <img src="Results/petition_form.jpeg" width="950">
</p>

The Petition Form enables members to formally propose changes, requests, or improvements within the community.

This module encourages:

* Democratic participation
* Transparent administration
* Organized request handling
* Community involvement

---

# Voting System

<p align="center">
  <img src="Results/create voting.jpeg" width="950">
</p>

The Voting Module allows communities to conduct interactive polls and democratic decision-making processes in real time.

Administrators can:

* Create polls
* Configure voting rules
* Control result visibility
* Set voting durations

Members can participate through synchronized and user-friendly voting interfaces.

---

# Voting Results

<p align="center">
  <img src="Results/Voting Results.jpeg" width="950">
</p>

The Voting Results interface displays live poll outcomes using dynamic and visually organized result charts.

This feature improves:

* Transparency
* Participation tracking
* Community trust
* Collective decision-making

---

# Events Module

<p align="center">
  <img src="Results/Created_events.jpeg" width="950">
</p>

The Events Module helps administrators organize meetings, celebrations, maintenance activities, and community programs.

The system manages:

* Event scheduling
* Date and time coordination
* Event announcements
* Community participation

This improves coordination and ensures that members remain informed about upcoming activities.

---

# Announcement Module

<p align="center">
  <img src="Results/Announcements.jpeg" width="950">
</p>

The Announcement Module allows Heads and Administrators to instantly broadcast important information to all members within the community.

This reduces communication delays and improves information accessibility for all users.

Main uses:

* Emergency notices
* Event announcements
* Policy updates
* Community alerts

---

# Group Chat Module

<p align="center">
  <img src="Results/common chat group.jpeg" width="950">
</p>

The Group Chat system enables real-time communication between community members using Socket.IO technology.

Features include:

* Instant messaging
* Real-time synchronization
* Group coordination
* Community discussions
* Message storage

This removes dependency on external messaging platforms and centralizes communication within the platform.

---

# Member Management Module

<p align="center">
  <img src="Results/Manage_members.jpeg" width="950">
</p>

The Member Management Module allows administrators to manage participation and maintain proper governance within communities.

Functions include:

* Member approvals
* Role assignment
* Community moderation
* Access control
* User management

This ensures secure and organized community administration.

---

# System Architecture

<p align="center">
  <img src="Results/architecture.jpeg" width="1000">
</p>

AgoraHub follows a modular multi-layer architecture consisting of frontend applications, backend services, AI systems, databases, and caching layers.

### Architecture Components

| Layer                   | Technology            |
| ----------------------- | --------------------- |
| Frontend                | React Native, Expo    |
| Backend                 | Node.js, Express.js   |
| Authentication          | JWT                   |
| Database                | PostgreSQL + pgvector |
| Real-Time Communication | Socket.IO             |
| AI Services             | Ollama / OpenAI       |
| Cache                   | Redis                 |
| Containerization        | Docker Compose        |

The architecture ensures:

* Scalability
* Security
* Real-time communication
* AI integration
* Efficient data handling

---

# Use Case Diagram

<p align="center">
  <img src="Results/use_case_diagram.jpeg" width="1000">
</p>

The Use Case Diagram illustrates interactions between users and the AgoraHub system.

### Main Actors

* Member
* Admin
* Head
* AI System

### Core Functionalities

* Registration and Login
* Community Creation
* Complaint Management
* Petition Handling
* Voting and Polling
* Event Management
* Group Communication
* AI Assistance

The diagram demonstrates how different users interact with platform modules while maintaining role-based access control.

---

# AI & RAG Integration

AgoraHub integrates Large Language Models (LLMs) with Retrieval-Augmented Generation (RAG) to provide intelligent and community-aware assistance.

Instead of generating generic AI responses, the system retrieves community-specific documents and contextual information before generating outputs.

This improves:

* Response accuracy
* Context awareness
* Relevance
* Transparency

Supported AI functionalities:

* Complaint summarization
* Petition analysis
* Community Q&A
* Moderation assistance
* Multilingual summaries

---

# Security Features

* JWT Authentication
* bcrypt password hashing
* Role-based access control
* Secure API communication
* Community-level authorization
* AI moderation support

---

# Advantages

* Centralized governance
* Organized communication
* Real-time interaction
* Transparent issue tracking
* AI-assisted administration
* Secure and scalable architecture
* Improved community participation

---

# Future Enhancements

* Advanced analytics dashboard
* Push notifications
* Video/audio communication
* Smart recommendations
* Cloud deployment scaling
* Multilingual interface

---

# Tech Stack

## Frontend

* React Native
* Expo
* TypeScript

## Backend

* Node.js
* Express.js
* Socket.IO

## Database

* PostgreSQL
* pgvector

## AI & NLP

* Ollama
* OpenAI
* Redis
* RAG

## Security

* JWT
* bcrypt

## Deployment

* Docker Compose

---

# Conclusion

AgoraHub provides a modern, transparent, and intelligent approach to community governance by integrating communication, administration, participation, and AI assistance into one unified digital platform.

By combining real-time technologies, secure authentication, vector databases, Retrieval-Augmented Generation (RAG), and modular architecture, AgoraHub transforms traditional community management into an efficient, scalable, and organized digital ecosystem.

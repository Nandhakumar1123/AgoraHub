const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
require("dotenv").config();

// Import NLP service components
const { logger } = require('./nlp-service/config/logger');
const { redis } = require('./nlp-service/config/redis');
const { preloadModels } = require('./nlp-service/services/nlp.service');
const { moderateContent: nlpModerateContent } = require('./nlp-service/services/moderation.service');
const { analyzeContentWithLLM } = require('./nlp-service/services/content-analysis.service');
const { queryOllama } = require('./nlp-service/services/rag.service');
console.log('moderateContent is:', nlpModerateContent);

// Import NLP routes
const nlpRoutes = require('./nlp-service/routes/nlp.routes');
const botRoutes = require('./nlp-service/routes/bot.routes');
const adminRoutes = require('./nlp-service/routes/admin.routes');

// Import auth middleware
const { authenticateToken } = require("./nlp-service/middleware/auth");

// ========================================================================
// CONFIGURATION
// ========================================================================

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'f7afbadf5aebe45d52550ea827dcbb80ec981cafb6b5faa5cbed320fccf4d8b9';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

// ========================================================================
// DATABASE CONNECTION
// ========================================================================

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "db_mini",
  password: process.env.DB_PASSWORD || "nandha102",
  port: parseInt(process.env.DB_PORT) || 5432,
});

// Test database connection
pool.on('connect', () => {
  logger.info('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
  logger.error('❌ PostgreSQL connection error:', err);
});

// ========================================================================
// EXPRESS & SOCKET.IO SETUP
// ========================================================================

const app = express();
const server = http.createServer(app);

// Enhanced Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ========================================================================
// MIDDLEWARE
// ========================================================================

app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

app.use(compression());
app.use(bodyParser.json());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  next();
});

// ========================================================================
// UTILITY FUNCTIONS
// ========================================================================

function generateToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      userId: user.user_id, // For NLP service compatibility
      full_name: user.full_name,
      email: user.email,
      profile_type: user.profile_type,
      role: user.role || 'user',
      communityId: user.community_id || null,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function registerUser(
  fullName,
  email,
  mobileNumber,
  password,
  preferredLanguage,
  voiceSupport,
  acceptTerms,
  profileType
) {
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO users 
     (full_name, email, mobile_number, password_hash, preferred_language, voice_support, accept_terms, profile_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING user_id, full_name, email, profile_type, registration_date`,
    [
      fullName,
      email,
      mobileNumber || null,
      passwordHash,
      preferredLanguage || "en",
      voiceSupport || false,
      acceptTerms || false,
      profileType,
    ]
  );
  return result.rows[0];
}

// ========================================================================
// SOCKET.IO CONNECTION TRACKING
// ========================================================================

const connectedUsers = new Map();

// ========================================================================
// HEALTH CHECK & ROOT ENDPOINTS
// ========================================================================

app.get("/", (req, res) => {
  res.send("✅ Civix Community Platform API is running!");
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'civix-community-platform',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    modules: {
      community: 'active',
      nlp: 'active',
      chat: 'active',
    }
  });
});

app.get("/api/test", (req, res) => {
  console.log("✅ Test endpoint called");
  res.json({
    message: "API is working",
    timestamp: new Date().toISOString(),
    endpoints: {
      login: "POST /api/login",
      createCommunity: "POST /api/create_community",
      joinCommunity: "POST /api/join_community",
      nlpAnalyze: "POST /api/nlp/analyze",
      botAsk: "POST /api/bot/ask",
    }
  });
});

// ========================================================================
// AUTHENTICATION ENDPOINTS
// ========================================================================

// Registration endpoints
app.post("/api/register", async (req, res) => {
  try {
    const {
      fullName,
      email,
      mobileNumber,
      password,
      preferredLanguage,
      voiceSupport,
      acceptTerms,
      profileType: bodyProfileType,
      privacyPreferences,
    } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const profileType = bodyProfileType || (privacyPreferences && privacyPreferences.profileType === "opaque" ? "private" : "transparent") || "transparent";
    const newUser = await registerUser(
      fullName,
      email,
      mobileNumber,
      password,
      preferredLanguage,
      voiceSupport,
      acceptTerms,
      profileType
    );

    const token = generateToken(newUser);
    res.status(201).json({
      message: "User registered successfully",
      token,
      user: newUser,
    });
  } catch (error) {
    console.error("Error inserting user:", error);
    if (error.code === "23505") {
      res.status(400).json({ error: "Email already exists" });
    } else {
      res.status(500).json({ error: "Registration failed" });
    }
  }
});

app.post("/api/register-transparent", async (req, res) => {
  try {
    const {
      fullName,
      email,
      mobileNumber,
      password,
      preferredLanguage,
      voiceSupport,
      acceptTerms,
    } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newUser = await registerUser(
      fullName,
      email,
      mobileNumber,
      password,
      preferredLanguage,
      voiceSupport,
      acceptTerms,
      "transparent"
    );
    const token = generateToken(newUser);
    res.status(201).json({
      message: "User registered successfully (Transparent profile)",
      token,
      user: newUser,
    });
  } catch (error) {
    console.error("Error registering transparent user:", error);
    if (error.code === "23505") {
      res.status(400).json({ error: "Email already exists" });
    } else {
      res.status(500).json({ error: "Registration failed" });
    }
  }
});

app.post("/api/register-private", async (req, res) => {
  try {
    const {
      fullName,
      email,
      mobileNumber,
      password,
      preferredLanguage,
      voiceSupport,
      acceptTerms,
    } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newUser = await registerUser(
      fullName,
      email,
      mobileNumber,
      password,
      preferredLanguage,
      voiceSupport,
      acceptTerms,
      "private"
    );
    const token = generateToken(newUser);
    res.status(201).json({
      message: "User registered successfully (Private profile)",
      token,
      user: newUser,
    });
  } catch (error) {
    console.error("Error registering private user:", error);
    if (error.code === "23505") {
      res.status(400).json({ error: "Email already exists" });
    } else {
      res.status(500).json({ error: "Registration failed" });
    }
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: "Email/Username and password are required" });
    }

    const trimmed = String(emailOrUsername).trim();
    const userResult = await pool.query(
      `SELECT user_id, full_name, email, password_hash, profile_type
       FROM users
       WHERE LOWER(TRIM(email)) = LOWER($1) OR LOWER(TRIM(full_name)) = LOWER($1)`,
      [trimmed]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await pool.query(
      `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1`,
      [user.user_id]
    );

    const token = generateToken(user);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        profile_type: user.profile_type,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// ========================================================================
// PROFILE & ACCOUNT ENDPOINTS
// ========================================================================

// Get user profile
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Fetch from users and user_profiles (if exists)
    const result = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.mobile_number, u.profile_type, 
              up.bio, up.profile_image, up.description
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE u.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Update user profile
app.put("/api/profile", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.user_id;
    const { full_name, mobile_number, bio, description } = req.body;

    await client.query("BEGIN");

    // Update users table
    if (full_name || mobile_number) {
      const updates = [];
      const values = [];
      if (full_name) {
        updates.push(`full_name = $${updates.length + 1}`);
        values.push(full_name);
      }
      if (mobile_number) {
        updates.push(`mobile_number = $${updates.length + 1}`);
        values.push(mobile_number);
      }
      values.push(userId);
      await client.query(
        `UPDATE users SET ${updates.join(", ")} WHERE user_id = $${values.length}`,
        values
      );
    }

    // Update or Insert into user_profiles
    const profileCheck = await client.query(
      `SELECT 1 FROM user_profiles WHERE user_id = $1`,
      [userId]
    );

    if (profileCheck.rows.length > 0) {
      await client.query(
        `UPDATE user_profiles 
         SET bio = COALESCE($1, bio), 
             description = COALESCE($2, description),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3`,
        [bio, description, userId]
      );
    } else {
      await client.query(
        `INSERT INTO user_profiles (user_id, bio, description)
         VALUES ($1, $2, $3)`,
        [userId, bio || "", description || ""]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  } finally {
    client.release();
  }
});

// Change password
app.post("/api/change-password", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { currentPassword, oldPassword, newPassword } = req.body;
    const effectiveCurrentPassword = currentPassword || oldPassword;

    if (!effectiveCurrentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new passwords are required" });
    }

    const userResult = await pool.query(
      `SELECT password_hash FROM users WHERE user_id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(effectiveCurrentPassword, userResult.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect current password" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE user_id = $2`,
      [newHash, userId]
    );

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// Delete account
app.delete("/api/delete-account", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Cascading delete should handle memberships, profiles, etc.
    await pool.query(`DELETE FROM users WHERE user_id = $1`, [userId]);
    
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// Upload profile image (Simplified)
app.post("/api/profile/upload-image", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { imageUri } = req.body; 

    if (!imageUri) {
      return res.status(400).json({ error: "No image provided" });
    }

    await pool.query(
      `INSERT INTO user_profiles (user_id, profile_image)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET profile_image = $2, updated_at = CURRENT_TIMESTAMP`,
      [userId, imageUri]
    );

    res.json({ message: "Image uploaded successfully", profile_image: imageUri });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// ========================================================================
// NLP SERVICE ROUTES
// ========================================================================

app.use('/api/nlp', nlpRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/admin', adminRoutes);

// ========================================================================
// COMMUNITY ENDPOINTS
// ========================================================================

// (Include all your existing community endpoints here - I'll add them below)
// Create community, join community, get communities, etc.

app.post("/api/create_community", authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      community_type,
      complaints_enabled = true,
      petitions_enabled = true,
      voting_enabled = true,
      group_chat_enabled = false,
      anonymous_enabled = false,
    } = req.body;
    const created_by = req.user.user_id;

    if (!name || !community_type || !created_by) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let code;
    while (true) {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existing = await pool.query(`SELECT 1 FROM communities WHERE code=$1`, [code]);
      if (existing.rows.length === 0) break;
    }

    const communityResult = await pool.query(
      `INSERT INTO communities 
      (code, name, description, community_type, created_by,
       complaints_enabled, petitions_enabled, voting_enabled, group_chat_enabled, anonymous_enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING community_id, code, name, description, community_type,
                 complaints_enabled, petitions_enabled, voting_enabled, group_chat_enabled, anonymous_enabled, created_at`,
      [code, name, description || "", community_type, created_by,
        complaints_enabled, petitions_enabled, voting_enabled, group_chat_enabled, anonymous_enabled]
    );

    const community = communityResult.rows[0];

    await pool.query(
      `INSERT INTO memberships (user_id, community_id, role, status)
       VALUES ($1, $2, 'HEAD', 'ACTIVE')`,
      [created_by, community.community_id]
    );

    res.status(201).json({
      message: "✅ Community created successfully",
      community: community,
    });
  } catch (error) {
    console.error("❌ Error creating community:", error);
    res.status(500).json({ error: "Error creating community" });
  }
});

// Get community by code
app.get("/api/community/:code", async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.query(
      `SELECT 
         c.community_id AS id,
         c.code,
         c.name,
         c.description,
         u.full_name AS head_name,
         c.created_at
       FROM communities c
       JOIN users u ON c.created_by = u.user_id
       WHERE c.code = $1`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error fetching community:", error);
    res.status(500).json({ error: "Error fetching community" });
  }
});

// Join community
app.post("/api/join_community", authenticateToken, async (req, res) => {
  try {
    const community_id_raw = req.body.community_id;
    const community_id = parseInt(community_id_raw, 10);

    if (isNaN(community_id)) {
      return res.status(400).json({ error: "Invalid community ID provided" });
    }
    const user_id = req.user.user_id;

    if (!user_id || !community_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = await pool.query(
      `SELECT * FROM memberships 
       WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [user_id, community_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Already an active member of this community" });
    }

    await pool.query(
      `INSERT INTO memberships (user_id, community_id, role, status)
       VALUES ($1, $2, 'MEMBER', 'ACTIVE')`,
      [user_id, community_id]
    );

    const joinedCommunity = await pool.query(
      `SELECT 
         c.community_id AS id,
         c.code,
         c.name,
         c.description,
         u.full_name AS head_name,
         c.created_at
       FROM communities c
       JOIN users u ON c.created_by = u.user_id
       WHERE c.community_id = $1`,
      [community_id]
    );

    res.status(201).json({
      message: "✅ Joined community successfully",
      community: joinedCommunity.rows[0],
    });
  } catch (error) {
    console.error("❌ Error joining community:", error);
    res.status(500).json({ error: "Error joining community" });
  }
});

// Fetch communities created by user (HEAD)
app.get("/api/created_communities/:user_id", authenticateToken, async (req, res) => {
  try {
    const { user_id: param_user_id } = req.params;
    const authenticated_user_id = req.user.user_id;

    if (parseInt(param_user_id) !== authenticated_user_id) {
      return res.status(403).json({ error: "Unauthorized access to created communities" });
    }

    const communitiesResult = await pool.query(
      `SELECT
         c.community_id AS id,
         c.code,
         c.name,
         c.description,
         COUNT(DISTINCT m_all.user_id) AS member_count,
         c.created_at
       FROM communities c
       LEFT JOIN memberships m_all ON c.community_id = m_all.community_id AND m_all.status = 'ACTIVE'
       JOIN memberships m_user ON c.community_id = m_user.community_id
       WHERE m_user.user_id = $1 AND m_user.role = 'HEAD' AND m_user.status = 'ACTIVE'
       GROUP BY c.community_id, c.code, c.name, c.description, c.created_at
       ORDER BY c.created_at DESC`,
      [authenticated_user_id]
    );

    const communitiesWithHeads = await Promise.all(
      communitiesResult.rows.map(async (community) => {
        const headsResult = await pool.query(
          `SELECT u.full_name
           FROM users u
           JOIN memberships m ON u.user_id = m.user_id
           WHERE m.community_id = $1 AND m.role = 'HEAD' AND m.status = 'ACTIVE'
           ORDER BY u.full_name`,
          [community.id]
        );

        const headNames = headsResult.rows.map(row => row.full_name);
        return {
          ...community,
          head_name: headNames.length > 0 ? headNames.join(', ') : 'No heads'
        };
      })
    );

    res.json(communitiesWithHeads);
  } catch (error) {
    console.error("❌ Error fetching created communities:", error);
    res.status(500).json({ error: "Error fetching created communities" });
  }
});

// Fetch communities joined by user (MEMBER)
app.get("/api/joined_communities/:user_id", authenticateToken, async (req, res) => {
  try {
    const { user_id: param_user_id } = req.params;
    const authenticated_user_id = req.user.user_id;

    if (parseInt(param_user_id) !== authenticated_user_id) {
      return res.status(403).json({ error: "Unauthorized access to joined communities" });
    }

    const communitiesResult = await pool.query(
      `SELECT
         c.community_id AS id,
         c.code,
         c.name,
         c.description,
         COUNT(DISTINCT m_all.user_id) AS member_count,
         c.created_at
       FROM communities c
       LEFT JOIN memberships m_all ON c.community_id = m_all.community_id AND m_all.status = 'ACTIVE'
       JOIN memberships m_user ON c.community_id = m_user.community_id
       WHERE m_user.user_id = $1 AND m_user.role = 'MEMBER' AND m_user.status = 'ACTIVE'
       GROUP BY c.community_id, c.code, c.name, c.description, c.created_at
       ORDER BY c.created_at DESC`,
      [authenticated_user_id]
    );

    const communitiesWithHeads = await Promise.all(
      communitiesResult.rows.map(async (community) => {
        const headsResult = await pool.query(
          `SELECT u.full_name
           FROM users u
           JOIN memberships m ON u.user_id = m.user_id
           WHERE m.community_id = $1 AND m.role = 'HEAD' AND m.status = 'ACTIVE'
           ORDER BY u.full_name`,
          [community.id]
        );

        const headNames = headsResult.rows.map(row => row.full_name);
        return {
          ...community,
          head_name: headNames.length > 0 ? headNames.join(', ') : 'No heads'
        };
      })
    );

    res.json(communitiesWithHeads);
  } catch (error) {
    console.error("❌ Error fetching joined communities:", error);
    res.status(500).json({ error: "Error fetching joined communities" });
  }
});

// Get community members
app.get("/api/community_members/:community_id", authenticateToken, async (req, res) => {
  try {
    const { community_id } = req.params;
    const authenticated_user_id = req.user.user_id;

    const membershipCheck = await pool.query(
      `SELECT role FROM memberships
       WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [authenticated_user_id, community_id]
    );

    if (membershipCheck.rows.length === 0) {
      return res.status(403).json({ error: "Not a member of this community" });
    }

    const userRole = membershipCheck.rows[0].role;

    const membersResult = await pool.query(
      `SELECT
         u.user_id,
         u.full_name,
         u.email,
         u.mobile_number,
         u.preferred_language,
         u.voice_support,
         u.profile_type,
         m.role,
         m.joined_at AS joined_at
       FROM users u
       JOIN memberships m ON u.user_id = m.user_id
       WHERE m.community_id = $1 AND m.status = 'ACTIVE'
       ORDER BY m.joined_at ASC`,
      [community_id]
    );

    let members = membersResult.rows;

    if (userRole === 'MEMBER') {
      members = members.map(member => {
        if (member.profile_type === 'private') {
          return {
            user_id: member.user_id,
            full_name: member.full_name,
            profile_type: member.profile_type,
            role: member.role,
            joined_at: member.joined_at
          };
        } else {
          return member;
        }
      });
    }

    res.json({
      community_id: parseInt(community_id),
      members: members,
      user_role: userRole
    });

  } catch (error) {
    console.error("❌ Error fetching community members:", error);
    res.status(500).json({ error: "Error fetching community members" });
  }
});

// Get community heads
app.get("/api/communities/:communityId/head", async (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId, 10);

    if (isNaN(communityId)) {
      return res.status(400).json({ error: "Invalid community ID" });
    }

    const result = await pool.query(
      `SELECT u.full_name AS head_name
       FROM users u
       JOIN memberships m ON u.user_id = m.user_id
       WHERE m.community_id = $1
       AND m.role = 'HEAD'
       AND m.status = 'ACTIVE'
       LIMIT 1`,
      [communityId]
    );

    if (result.rows.length > 0) {
      return res.json({ head_name: result.rows[0].head_name });
    }

    const creatorResult = await pool.query(
      `SELECT u.full_name AS head_name
       FROM communities c
       JOIN users u ON c.created_by = u.user_id
       WHERE c.community_id = $1`,
      [communityId]
    );

    if (creatorResult.rows.length > 0) {
      return res.json({ head_name: creatorResult.rows[0].head_name });
    }

    res.json({ head_name: "Unknown" });
  } catch (err) {
    console.error("Error fetching community head:", err);
    res.status(500).json({ error: "Failed to fetch community head" });
  }
});

// Get community heads (for anonymous chat)
app.get("/api/communities/:communityId/heads", authenticateToken, async (req, res) => {
  try {
    const { communityId } = req.params;

    const communityIdInt = parseInt(communityId, 10);
    if (isNaN(communityIdInt)) {
      return res.status(400).json({ error: "Invalid community ID" });
    }

    const result = await pool.query(
      `SELECT 
         u.user_id,
         u.full_name,
         m.role
       FROM memberships m
       JOIN users u ON m.user_id = u.user_id
       WHERE 
         m.community_id = $1
         AND m.role = 'HEAD'
         AND m.status = 'ACTIVE'`,
      [communityIdInt]
    );

    if (result.rows.length === 0) {
      const fallback = await pool.query(
        `SELECT u.user_id, u.full_name, 'HEAD' AS role
         FROM communities c
         JOIN users u ON c.created_by = u.user_id
         WHERE c.community_id = $1`,
        [communityIdInt]
      );

      if (fallback.rows.length > 0) {
        return res.json({ heads: fallback.rows });
      }
    }

    res.json({ heads: result.rows });
  } catch (err) {
    console.error("❌ Error fetching community heads:", err);
    res.status(500).json({ error: "Failed to fetch community heads" });
  }
});

// Promote member to head
app.post("/api/communities/:communityId/promote_member", authenticateToken, async (req, res) => {
  try {
    const { communityId } = req.params;
    const { member_id } = req.body;
    const requestingUserId = req.user.user_id;

    const requestingUserCheck = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [requestingUserId, communityId]
    );

    if (requestingUserCheck.rows.length === 0 || !['HEAD', 'ADMIN'].includes(requestingUserCheck.rows[0].role)) {
      return res.status(403).json({ error: "Only community HEAD or ADMIN can promote members" });
    }

    const memberCheck = await pool.query(
      `SELECT user_id, role FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [member_id, communityId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: "Member not found in this community" });
    }

    if (memberCheck.rows[0].role === 'HEAD') {
      return res.status(400).json({ error: "Member is already a HEAD" });
    }

    await pool.query(
      `UPDATE memberships SET role = 'HEAD' WHERE user_id = $1 AND community_id = $2`,
      [member_id, communityId]
    );

    res.json({ message: "Member successfully promoted to HEAD" });
  } catch (error) {
    console.error("❌ Error promoting member:", error);
    res.status(500).json({ error: "Failed to promote member" });
  }
});

// Update community features (Admin only)
app.put("/api/update_community_features/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      complaints_enabled,
      petitions_enabled,
      voting_enabled,
      group_chat_enabled,
      anonymous_enabled,
    } = req.body;

    const communityCheck = await pool.query(
      `SELECT created_by FROM communities WHERE community_id = $1`,
      [id]
    );

    if (communityCheck.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }

    if (communityCheck.rows[0].created_by !== req.user.user_id) {
      return res.status(403).json({ error: "Unauthorized to update community features" });
    }

    await pool.query(
      `UPDATE communities
       SET complaints_enabled = $1,
           petitions_enabled = $2,
           voting_enabled = $3,
           group_chat_enabled = $4,
           anonymous_enabled = $5
       WHERE community_id = $6`,
      [complaints_enabled, petitions_enabled, voting_enabled, group_chat_enabled, anonymous_enabled, id]
    );

    res.json({ message: "✅ Community feature settings updated successfully" });
  } catch (error) {
    console.error("❌ Error updating community settings:", error);
    res.status(500).json({ error: "Failed to update feature toggles" });
  }
});

// ========================================================================
// CHAT MESSAGES WITH NLP MODERATION
// ========================================================================

app.post('/api/communities/:communityId/messages', authenticateToken, async (req, res) => {
  try {
    const communityIdParam = req.params.communityId;
    const communityId = parseInt(communityIdParam, 10);
    if (isNaN(communityId)) {
      return res.status(400).json({ error: 'Invalid community ID' });
    }

    const { content, message_type = 'text', attachments = [], parent_message_id, _id } = req.body;

    const sender_id = req.user.user_id;

    if (!sender_id) {
      return res.status(401).json({ error: 'Authentication failed - no user ID in token' });
    }

    if (content == null || (typeof content === 'string' && content.trim() === '')) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const contentStr = typeof content === 'string' ? content : String(content);

    // Validate membership
    const membershipCheck = await pool.query(
      `SELECT role FROM memberships
           WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [sender_id, communityId]
    );

    if (membershipCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this community' });
    }

    // ✅ NLP MODERATION INTEGRATION (fail-open: allow message if NLP errors)
    if (contentStr && contentStr.trim().length > 0) {
      try {
        const moderationResult = await nlpModerateContent(
          contentStr,
          communityId,
          sender_id,
          message_type
        );

        // If message is quarantined, notify user and don't send message
        if (moderationResult && !moderationResult.approved) {
          return res.status(403).json({
            error: 'Message flagged for review',
            reason: moderationResult.reason,
            holdId: moderationResult.holdId,
            action: moderationResult.action,
          });
        }
      } catch (nlpError) {
        // If NLP service fails, log error but allow message (fail-open)
        logger.error('NLP moderation failed, allowing message', { error: nlpError.message });
      }
    }

    // Get sender information
    const senderQuery = await pool.query(
      `SELECT u.user_id, u.full_name, u.profile_type, m.role
           FROM users u
           LEFT JOIN memberships m ON u.user_id = m.user_id AND m.community_id = $1
           WHERE u.user_id = $2`,
      [communityId, sender_id]
    );

    if (senderQuery.rows.length === 0) {
      console.error(`❌ User ${sender_id} not found in database`);
      return res.status(403).json({ error: 'User not found or not a member of this community' });
    }

    const senderInfo = senderQuery.rows[0];

    // Insert message
    const result = await pool.query(`
          INSERT INTO chat_messages (community_id, sender_id, message_type, content, attachments, parent_message_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
      `, [communityId, sender_id, message_type, contentStr, JSON.stringify(attachments || []), parent_message_id || null]);

    const message = result.rows[0];

    const fullMessage = {
      message_id: parseInt(message.message_id),
      community_id: parseInt(message.community_id),
      sender_id: parseInt(message.sender_id),
      full_name: senderInfo.full_name,
      profile_type: senderInfo.profile_type,
      role: senderInfo.role,
      message_type: message.message_type,
      content: message.content,
      attachments: message.attachments,
      parent_message_id: message.parent_message_id,
      created_at: message.created_at,
      _id: _id || undefined,
      moderated: true, // Indicate message passed moderation
    };

    // Broadcast to community (room name must match what clients join)
    io.to(`community_${communityId}`).emit('new_message', fullMessage);

    res.json(fullMessage);
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get chat summary and recommendations for a community
app.get('/api/community/:communityId/chat-summary', authenticateToken, async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.user_id;

    // Verify membership
    const membershipCheck = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [userId, communityId]
    );

    if (membershipCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not an active member of this community' });
    }

    // Fetch today's messages (UTC)
    const messagesResult = await pool.query(
      `SELECT content, created_at FROM chat_messages 
       WHERE community_id = $1 AND created_at >= CURRENT_DATE
       ORDER BY created_at ASC`,
      [communityId]
    );

    if (messagesResult.rows.length === 0) {
      return res.json({
        summary: 'No chat activity today.',
        recommendations: 'Encourage members to share updates or concerns to get a daily summary!',
        count: 0
      });
    }

    const chatText = messagesResult.rows.map(m => m.content).join('\n');

    // 1. Generate Summary
    const summaryPrompt = `Summarize the following community chat messages in a concise paragraph (max 4 sentences):\n\n${chatText}`;
    const summaryRes = await queryOllama(summaryPrompt);
    const summary = summaryRes.response;

    // 2. Generate Recommendations/Solutions
    const recommendationsPrompt = `Based on the following community chat summary, provide 2-3 actionable recommendations or solutions for the community heads. Keep it brief and constructive:\n\nSummary: ${summary}`;
    const recommendationsRes = await queryOllama(recommendationsPrompt);
    const recommendations = recommendationsRes.response;

    res.json({
      summary,
      recommendations,
      count: messagesResult.rows.length
    });

  } catch (error) {
    logger.error('Error generating chat summary:', { error: error.message });
    res.status(500).json({ error: 'Failed to generate chat summary. Please ensure Ollama is running.' });
  }
});


app.get('/api/communities/:communityId/messages', authenticateToken, async (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId, 10);
    if (isNaN(communityId)) {
      return res.status(400).json({ error: 'Invalid community ID' });
    }
    const { limit = 50, before } = req.query;

    let query = `
          SELECT 
              cm.message_id,
              cm.community_id,
              cm.sender_id,
              cm.message_type,
              cm.content,
              cm.attachments,
              cm.parent_message_id,
              cm.created_at,
              u.full_name,
              u.profile_type,
              m.role,
              (SELECT COUNT(*) FROM chat_messages WHERE parent_message_id = cm.message_id) as reply_count
          FROM chat_messages cm
          LEFT JOIN users u ON cm.sender_id = u.user_id
          LEFT JOIN memberships m ON u.user_id = m.user_id AND m.community_id = cm.community_id
          WHERE cm.community_id = $1
      `;
    const params = [communityId];

    if (before) {
      query += ` AND cm.created_at < $2`;
      params.push(before);
    }

    query += ` ORDER BY cm.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    const messages = result.rows.map(msg => ({
      ...msg,
      message_id: parseInt(msg.message_id),
      community_id: parseInt(msg.community_id),
      sender_id: msg.sender_id ? parseInt(msg.sender_id) : null,
      reply_count: parseInt(msg.reply_count || 0)
    }));

    res.json(messages.reverse());
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/communities/:communityId/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId, 10);
    const messageId = parseInt(req.params.messageId, 10);
    const senderId = req.user.user_id;
    const { content } = req.body || {};

    if (isNaN(communityId) || isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const roleCheck = await pool.query(
      `SELECT role FROM memberships
       WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [senderId, communityId]
    );
    if (roleCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a community member' });
    }
    const role = roleCheck.rows[0].role;

    const messageCheck = await pool.query(
      `SELECT message_id, sender_id, community_id, message_type
       FROM chat_messages
       WHERE message_id = $1 AND community_id = $2`,
      [messageId, communityId]
    );
    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const target = messageCheck.rows[0];
    const isOwner = Number(target.sender_id) === Number(senderId);
    const canModerate = role === 'HEAD' || role === 'ADMIN';
    if (!isOwner && !canModerate) {
      return res.status(403).json({ error: 'Not allowed to edit this message' });
    }

    const updated = await pool.query(
      `UPDATE chat_messages
       SET content = $1
       WHERE message_id = $2 AND community_id = $3
       RETURNING *`,
      [String(content).trim(), messageId, communityId]
    );

    const message = updated.rows[0];
    const senderInfo = await pool.query(
      `SELECT u.full_name, u.profile_type, m.role
       FROM users u
       LEFT JOIN memberships m ON u.user_id = m.user_id AND m.community_id = $1
       WHERE u.user_id = $2`,
      [communityId, message.sender_id]
    );
    const sender = senderInfo.rows[0] || {};

    const fullMessage = {
      message_id: parseInt(message.message_id, 10),
      community_id: parseInt(message.community_id, 10),
      sender_id: message.sender_id ? parseInt(message.sender_id, 10) : null,
      message_type: message.message_type,
      content: message.content,
      attachments: message.attachments,
      parent_message_id: message.parent_message_id,
      created_at: message.created_at,
      full_name: sender.full_name,
      profile_type: sender.profile_type,
      role: sender.role,
    };

    io.to(`community_${communityId}`).emit('message_updated', fullMessage);
    res.json(fullMessage);
  } catch (error) {
    console.error('❌ Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

app.delete('/api/communities/:communityId/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId, 10);
    const messageId = parseInt(req.params.messageId, 10);
    const senderId = req.user.user_id;

    if (isNaN(communityId) || isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    const roleCheck = await pool.query(
      `SELECT role FROM memberships
       WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [senderId, communityId]
    );
    if (roleCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a community member' });
    }
    const role = roleCheck.rows[0].role;

    const messageCheck = await pool.query(
      `SELECT message_id, sender_id
       FROM chat_messages
       WHERE message_id = $1 AND community_id = $2`,
      [messageId, communityId]
    );
    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const target = messageCheck.rows[0];
    const isOwner = Number(target.sender_id) === Number(senderId);
    const canModerate = role === 'HEAD' || role === 'ADMIN';
    if (!isOwner && !canModerate) {
      return res.status(403).json({ error: 'Not allowed to delete this message' });
    }

    await pool.query(
      `DELETE FROM chat_messages WHERE message_id = $1 AND community_id = $2`,
      [messageId, communityId]
    );

    io.to(`community_${communityId}`).emit('message_deleted', messageId);
    res.json({ success: true, message_id: messageId });
  } catch (error) {
    console.error('❌ Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Anonymous messages
app.post("/api/anonymous_messages", authenticateToken, async (req, res) => {
  try {
    const { text, headIds, attachments, communityId, parent_id } = req.body;
    const senderId = req.user.user_id;

    if (!text || !communityId) {
      return res.status(400).json({ error: "Text and communityId are required" });
    }

    const result = await pool.query(
      `INSERT INTO anonymous_messages (community_id, sender_id, text, head_ids, parent_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING message_id, created_at`,
      [communityId, senderId, text, headIds || [], parent_id || null]
    );

    const messageId = result.rows[0].message_id;

    if (Array.isArray(attachments) && attachments.length > 0) {
      const values = attachments
        .map(
          (a) =>
            `(${messageId}, '${a.name}', '${a.type}', '${a.uri}', '${a.mimeType || "unknown"}', ${a.size || 0
            })`
        )
        .join(",");

      await pool.query(
        `INSERT INTO anonymous_message_attachments
         (message_id, file_name, file_type, file_url, mime_type, file_size)
         VALUES ${values}`
      );
    }

    res.status(201).json({
      message: "✅ Anonymous message sent successfully",
      message_id: messageId,
    });
  } catch (error) {
    console.error("❌ Error sending anonymous message:", error);
    res.status(500).json({ error: "Failed to send anonymous message" });
  }
});

// Admin: Get all root anonymous messages for a community
app.get("/api/communities/:communityId/anonymous-messages", authenticateToken, async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.user_id;

    // Verify admin/head role
    const roleCheck = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [userId, communityId]
    );

    if (roleCheck.rows.length === 0 || !['HEAD', 'ADMIN'].includes(roleCheck.rows[0].role)) {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    const result = await pool.query(
      `SELECT am.*, 
              (SELECT COUNT(*) FROM anonymous_messages WHERE parent_id = am.message_id) as reply_count
       FROM anonymous_messages am
       WHERE am.community_id = $1 AND am.parent_id IS NULL
       ORDER BY am.created_at DESC`,
      [communityId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching anonymous messages:", error);
    res.status(500).json({ error: "Failed to fetch anonymous messages" });
  }
});

// Member: Get my anonymous messages (root messages only)
app.get("/api/communities/:communityId/my-anonymous-messages", authenticateToken, async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.user_id;

    const result = await pool.query(
      `SELECT am.*, 
              (SELECT COUNT(*) FROM anonymous_messages WHERE parent_id = am.message_id) as reply_count
       FROM anonymous_messages am
       WHERE am.community_id = $1 AND am.sender_id = $2 AND am.parent_id IS NULL
       ORDER BY am.created_at DESC`,
      [communityId, userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching my anonymous messages:", error);
    res.status(500).json({ error: "Failed to fetch your anonymous messages" });
  }
});

// Member: Get or start a single continuous anonymous chat
app.get("/api/communities/:communityId/anonymous-chat", authenticateToken, async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.user_id;

    // 1. Find the root message for this user in this community
    let rootResult = await pool.query(
      `SELECT * FROM anonymous_messages 
       WHERE community_id = $1 AND sender_id = $2 AND parent_id IS NULL
       LIMIT 1`,
      [communityId, userId]
    );

    let messages = [];
    let rootMessage = null;

    if (rootResult.rows.length > 0) {
      rootMessage = rootResult.rows[0];
      // 2. Fetch all messages in this thread
      const threadResult = await pool.query(
        `SELECT am.*, u.full_name as head_name
         FROM anonymous_messages am
         LEFT JOIN users u ON am.sender_id = u.user_id AND am.is_from_head = TRUE
         WHERE am.message_id = $1 OR am.parent_id = $1
         ORDER BY am.created_at ASC`,
        [rootMessage.message_id]
      );
      messages = threadResult.rows;
    }

    res.json({
      rootMessage,
      messages
    });
  } catch (error) {
    console.error("❌ Error fetching anonymous chat:", error);
    res.status(500).json({ error: "Failed to fetch anonymous chat" });
  }
});

// Member: Send a message in the continuous anonymous chat
app.post("/api/communities/:communityId/anonymous-chat/message", authenticateToken, async (req, res) => {
  try {
    const { communityId } = req.params;
    const { text, attachments } = req.body;
    const userId = req.user.user_id;

    if (!text) {
      return res.status(400).json({ error: "Message text is required" });
    }

    // 1. Find or create the root message
    let rootResult = await pool.query(
      `SELECT message_id FROM anonymous_messages 
       WHERE community_id = $1 AND sender_id = $2 AND parent_id IS NULL
       LIMIT 1`,
      [communityId, userId]
    );

    let rootMessageId;
    let isFirstMessage = false;

    if (rootResult.rows.length === 0) {
      // Create root message
      const newRootResult = await pool.query(
        `INSERT INTO anonymous_messages (community_id, sender_id, text, status)
         VALUES ($1, $2, $3, 'unread')
         RETURNING message_id`,
        [communityId, userId, text]
      );
      rootMessageId = newRootResult.rows[0].message_id;
      isFirstMessage = true;
    } else {
      rootMessageId = rootResult.rows[0].message_id;
    }

    let newMessage;
    if (isFirstMessage) {
      // The root message IS the new message
      const result = await pool.query(
        `SELECT * FROM anonymous_messages WHERE message_id = $1`,
        [rootMessageId]
      );
      newMessage = result.rows[0];
    } else {
      // Create as a reply to the root
      const result = await pool.query(
        `INSERT INTO anonymous_messages (community_id, sender_id, text, parent_id, is_from_head)
         VALUES ($1, $2, $3, $4, FALSE)
         RETURNING *`,
        [communityId, userId, text, rootMessageId]
      );
      newMessage = result.rows[0];

      // Update root status to unread when member sends a new message
      await pool.query(
        `UPDATE anonymous_messages SET status = 'unread' WHERE message_id = $1`,
        [rootMessageId]
      );
    }

    // Handle attachments if any
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        await pool.query(
          `INSERT INTO anonymous_message_attachments 
           (message_id, file_name, file_type, file_url, mime_type, file_size)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newMessage.message_id, att.name, att.type, att.uri, att.mimeType, att.size]
        );
      }
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("❌ Error sending anonymous message:", error);
    res.status(500).json({ error: "Failed to send anonymous message" });
  }
});

// Get message thread
app.get("/api/anonymous-messages/:messageId/thread", authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.user_id;

    // Check if user is either the sender OR an admin of the community
    const messageCheck = await pool.query(
      `SELECT community_id, sender_id FROM anonymous_messages WHERE message_id = $1`,
      [messageId]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    const { community_id, sender_id } = messageCheck.rows[0];

    const roleCheck = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [userId, community_id]
    );

    const isAdmin = roleCheck.rows.length > 0 && ['HEAD', 'ADMIN'].includes(roleCheck.rows[0].role);
    const isSender = sender_id === userId;

    if (!isAdmin && !isSender) {
      return res.status(403).json({ error: "Unauthorized access to this thread" });
    }

    const result = await pool.query(
      `SELECT am.*, u.full_name as head_name
       FROM anonymous_messages am
       LEFT JOIN users u ON am.sender_id = u.user_id AND am.is_from_head = TRUE
       WHERE am.message_id = $1 OR am.parent_id = $1
       ORDER BY am.created_at ASC`,
      [messageId]
    );

    // If admin is viewing, mark root message as read (if it's not from head)
    if (isAdmin) {
      await pool.query(
        `UPDATE anonymous_messages SET status = 'read' WHERE message_id = $1 AND is_from_head = FALSE`,
        [messageId]
      );
    }

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching message thread:", error);
    res.status(500).json({ error: "Failed to fetch message thread" });
  }
});

// Reply to anonymous message
app.post("/api/anonymous-messages/:messageId/reply", authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text, attachments } = req.body;
    const userId = req.user.user_id;

    if (!text) {
      return res.status(400).json({ error: "Reply text is required" });
    }

    const messageCheck = await pool.query(
      `SELECT community_id, sender_id FROM anonymous_messages WHERE message_id = $1`,
      [messageId]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    const { community_id, sender_id } = messageCheck.rows[0];

    const roleCheck = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [userId, community_id]
    );

    const isAdmin = roleCheck.rows.length > 0 && ['HEAD', 'ADMIN'].includes(roleCheck.rows[0].role);
    const isSender = sender_id === userId;

    if (!isAdmin && !isSender) {
      return res.status(403).json({ error: "Unauthorized to reply to this thread" });
    }

    const result = await pool.query(
      `INSERT INTO anonymous_messages (community_id, sender_id, text, parent_id, is_from_head)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [community_id, userId, text, messageId, isAdmin]
    );

    const newReply = result.rows[0];

    // Mark the entire thread as replied if admin is replying
    if (isAdmin) {
      await pool.query(
        `UPDATE anonymous_messages SET status = 'replied' WHERE message_id = $1`,
        [messageId]
      );
    }

    res.status(201).json(newReply);
  } catch (error) {
    console.error("❌ Error replying to anonymous message:", error);
    res.status(500).json({ error: "Failed to send reply" });
  }
});

// Public anonymous messages
app.post("/api/public/anonymous_messages", async (req, res) => {
  try {
    const { text, headIds, attachments, communityId } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Text is required and cannot be empty" });
    }

    if (!communityId) {
      return res.status(400).json({ error: "communityId is required" });
    }

    const numericCommunityId = typeof communityId === 'string' ? parseInt(communityId, 10) : Number(communityId);
    if (isNaN(numericCommunityId)) {
      return res.status(400).json({ error: `Invalid communityId: ${communityId}` });
    }

    let senderId = null;
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        senderId = decoded.user_id;
      } catch (tokenError) {
        // Continue as anonymous
      }
    }

    let numericHeadIds = [];

    if (Array.isArray(headIds) && headIds.length > 0) {
      const hasFallbackHead = headIds.includes('fallback-head');

      if (hasFallbackHead) {
        try {
          const headsResult = await pool.query(
            `SELECT m.user_id
             FROM memberships m
             WHERE m.community_id = $1
             AND m.role = 'HEAD'
             AND m.status = 'ACTIVE'`,
            [numericCommunityId]
          );

          if (headsResult.rows.length > 0) {
            numericHeadIds = headsResult.rows.map(row => row.user_id);
          } else {
            const creatorResult = await pool.query(
              `SELECT c.created_by AS user_id
               FROM communities c
               WHERE c.community_id = $1`,
              [numericCommunityId]
            );

            if (creatorResult.rows.length > 0 && creatorResult.rows[0].user_id) {
              numericHeadIds = [creatorResult.rows[0].user_id];
            }
          }
        } catch (headFetchError) {
          console.error('❌ Error fetching head IDs:', headFetchError);
        }
      }

      const validNumericIds = headIds
        .filter(id => id !== 'fallback-head' && typeof id === 'string')
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id));

      numericHeadIds = [...new Set([...numericHeadIds, ...validNumericIds])];
    }

    const headIdsArray = numericHeadIds.length > 0 ? numericHeadIds : [];

    let messageId;
    try {
      const result = await pool.query(
        `INSERT INTO anonymous_messages (community_id, sender_id, text, head_ids)
         VALUES ($1, $2, $3, $4)
         RETURNING message_id, created_at`,
        [numericCommunityId, senderId, text.trim(), headIdsArray]
      );

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Failed to insert message - no rows returned from INSERT');
      }

      messageId = result.rows[0].message_id;
    } catch (dbError) {
      console.error('❌ Database error during INSERT:', dbError);
      throw dbError;
    }

    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const attachment of attachments) {
        await pool.query(
          `INSERT INTO anonymous_message_attachments
           (message_id, file_name, file_type, file_url, mime_type, file_size)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            messageId,
            attachment.name,
            attachment.type,
            attachment.uri,
            attachment.mimeType || "unknown",
            attachment.size || 0
          ]
        );
      }
    }

    res.status(201).json({
      message: "✅ Anonymous message sent successfully",
      message_id: messageId,
    });
  } catch (error) {
    console.error("❌ Error sending anonymous message:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send anonymous message";
    res.status(500).json({ error: errorMessage });
  }
});

// ========================================================================
// PETITIONS, COMPLAINTS, EVENTS - (Continue with your existing code)
// ========================================================================

// [Add all your petition, complaint, and event endpoints here]
// Due to length, I'm including the structure - you can copy from your original file

app.post("/api/petitions", authenticateToken, async (req, res) => {
  try {
    const {
      title,
      summary,
      proposed_action,
      goal_type,
      other_goal_type,
      impact_area,
      other_impact_area,
      affected_groups,
      priority_level = 'normal',
      reference_context,
      visibility = 'public',
      community_id,
    } = req.body;

    const author_id = req.user.user_id;

    if (!title || !proposed_action || !goal_type || !impact_area || !community_id) {
      return res.status(400).json({
        error: 'Missing required fields: title, proposed_action, goal_type, impact_area, community_id',
      });
    }

    const memberCheck = await pool.query(
      `SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [author_id, community_id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You must be an active member of this community' });
    }

    const textToAnalyze = [title, summary, proposed_action].filter(Boolean).join('\n\n');

    const result = await pool.query(
      `INSERT INTO petitions (
        title, summary, proposed_action,
        goal_type, other_goal_type, impact_area, other_impact_area,
        affected_groups, priority_level, reference_context, visibility,
        author_id, community_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        title, summary || null, proposed_action,
        goal_type, other_goal_type || null, impact_area, other_impact_area || null,
        affected_groups || [], priority_level, reference_context || null, visibility,
        author_id, community_id, 'Pending',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating petition:', error);
    res.status(500).json({ error: error.message });
  }
});

// Petition detail (must be before /:communityId so "detail" is not captured)
app.get("/api/petitions/detail/:petitionId", authenticateToken, async (req, res) => {
  try {
    const petitionId = parseInt(req.params.petitionId, 10);
    if (isNaN(petitionId)) return res.status(400).json({ error: "Invalid petition ID" });
    const result = await pool.query(
      `SELECT p.*, u.full_name as author_name
       FROM petitions p
       JOIN users u ON p.author_id = u.user_id
       WHERE p.petition_id = $1`,
      [petitionId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Petition not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching petition detail:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/petitions/:petitionId", authenticateToken, async (req, res) => {
  try {
    const petitionId = parseInt(req.params.petitionId, 10);
    if (isNaN(petitionId)) return res.status(400).json({ error: "Invalid petition ID" });

    const petitionRes = await pool.query(
      `SELECT petition_id, community_id, author_id FROM petitions WHERE petition_id = $1`,
      [petitionId]
    );
    if (petitionRes.rows.length === 0) return res.status(404).json({ error: "Petition not found" });

    const { community_id, author_id } = petitionRes.rows[0];
    const userId = req.user?.user_id;

    const membershipRes = await pool.query(
      `SELECT role FROM memberships
       WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE' LIMIT 1`,
      [userId, community_id]
    );
    if (membershipRes.rows.length === 0) {
      return res.status(403).json({ error: "You must be an active member of this community" });
    }
    const role = membershipRes.rows[0].role;
    if (author_id !== userId && !["HEAD", "ADMIN"].includes(role)) {
      return res.status(403).json({ error: "Only the author or admins can delete this petition" });
    }

    await pool.query(`DELETE FROM petitions WHERE petition_id = $1`, [petitionId]);
    res.json({ success: true, message: "Petition deleted successfully" });
  } catch (error) {
    console.error("Error deleting petition:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/petitions/:communityId", authenticateToken, async (req, res) => {
  try {
    const { communityId } = req.params;
    const { filter } = req.query;

    let query = `
      SELECT p.*, u.full_name as author_name
      FROM petitions p
      JOIN users u ON p.author_id = u.user_id
      WHERE p.community_id = $1
    `;
    const params = [communityId];

    if (filter === 'today') {
      query += ` AND p.created_at >= CURRENT_DATE`;
    } else if (filter === 'yesterday') {
      query += ` AND p.created_at >= CURRENT_DATE - INTERVAL '1 day' AND p.created_at < CURRENT_DATE`;
    } else if (filter === 'month') {
      query += ` AND p.created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (filter === 'particular_day' && req.query.date) {
      query += ` AND p.created_at::date = $2`;
      params.push(req.query.date);
    } else if (filter === 'particular_month' && req.query.month) {
      query += ` AND TO_CHAR(p.created_at, 'YYYY-MM') = $2`;
      params.push(req.query.month);
    }

    query += ` ORDER BY p.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching petitions:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI process petition
app.post("/api/petitions/:petitionId/ai-process", authenticateToken, async (req, res) => {
  try {
    const petitionId = parseInt(req.params.petitionId, 10);
    if (isNaN(petitionId)) return res.status(400).json({ error: "Invalid petition ID" });

    const petitionRes = await pool.query(
      `SELECT p.*, u.full_name as author_name 
       FROM petitions p 
       JOIN users u ON p.author_id = u.user_id 
       WHERE p.petition_id = $1`,
      [petitionId]
    );

    if (petitionRes.rows.length === 0) return res.status(404).json({ error: "Petition not found" });
    const petition = petitionRes.rows[0];

    // Check permissions
    const userId = req.user.user_id;
    const membershipRes = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [userId, petition.community_id]
    );

    if (membershipRes.rows.length === 0 || !['HEAD', 'ADMIN'].includes(membershipRes.rows[0].role)) {
      return res.status(403).json({ error: "Only admins can trigger AI processing" });
    }

    const textToAnalyze = `${petition.title}\n\n${petition.summary}\n\n${petition.proposed_action}`;
    const analysis = await analyzeContentWithLLM(textToAnalyze, 'petition');

    let newStatus = 'Review';
    let remarks = `AI-generated verdict: ${analysis.llmVerdict}. ${analysis.llmSummary || ''}`;

    if (analysis.llmVerdict === 'POSITIVE') {
      newStatus = 'Approved';
    } else if (analysis.llmVerdict === 'NEGATIVE') {
      newStatus = 'Rejected';
    } else {
      newStatus = 'Pending';
    }

    const updateRes = await pool.query(
      `UPDATE petitions 
       SET status = $1, remarks = $2, reviewed_by = $3, nlp_analysis = $4, updated_at = CURRENT_TIMESTAMP
       WHERE petition_id = $5 
       RETURNING *`,
      [newStatus, remarks, userId, JSON.stringify(analysis), petitionId]
    );

    res.json({
      success: true,
      status: newStatus,
      analysis: analysis,
      petition: updateRes.rows[0]
    });

  } catch (error) {
    console.error('Error AI processing petition:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/petitions/:petitionId/status", authenticateToken, async (req, res) => {
  try {
    const petitionId = parseInt(req.params.petitionId, 10);
    if (isNaN(petitionId)) return res.status(400).json({ error: "Invalid petition ID" });

    const { status, remarks = "" } = req.body || {};
    const allowedStatuses = new Set(["Review", "Pending", "InProgress", "Approved", "Rejected"]);

    if (!status || typeof status !== "string" || !allowedStatuses.has(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${Array.from(allowedStatuses).join(", ")}`,
      });
    }
    Joseph

    const petitionRes = await pool.query(
      `SELECT petition_id, community_id FROM petitions WHERE petition_id = $1`,
      [petitionId]
    );
    if (petitionRes.rows.length === 0) return res.status(404).json({ error: "Petition not found" });

    const communityId = petitionRes.rows[0].community_id;
    const userId = req.user?.user_id;

    const membershipRes = await pool.query(
      `SELECT role
       FROM memberships
       WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'
       LIMIT 1`,
      [userId, communityId]
    );

    if (membershipRes.rows.length === 0) {
      return res.status(403).json({ error: "You must be an active member of this community" });
    }

    const role = membershipRes.rows[0].role;
    if (!["HEAD", "ADMIN"].includes(role)) {
      return res.status(403).json({ error: "Only admins can update petition status" });
    }

    const updateRes = await pool.query(
      `UPDATE petitions
       SET status = $1,
           remarks = $2,
           reviewed_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE petition_id = $4
       RETURNING *`,
      [status, String(remarks || ""), userId, petitionId]
    );

    res.json(updateRes.rows[0]);
  } catch (error) {
    console.error("Error updating petition status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Batch update petition status
app.post("/api/petitions/batch-status", authenticateToken, async (req, res) => {
  try {
    const { communityId, status, filter, date, month, currentStatus, remarks = "Batch update" } = req.body;
    const userId = req.user?.user_id;

    if (!communityId || !status) {
      return res.status(400).json({ error: "communityId and status are required" });
    }

    const allowedStatuses = new Set(["Pending", "Approved", "Rejected"]);
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }


    // Role check
    const membershipRes = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE' LIMIT 1`,
      [userId, communityId]
    );
    if (membershipRes.rows.length === 0 || !["HEAD", "ADMIN"].includes(membershipRes.rows[0].role)) {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    let whereClause = "WHERE community_id = $4";
    const params = [status, remarks, userId, communityId];

    if (filter === 'today') {
      whereClause += ` AND created_at >= CURRENT_DATE`;
    } else if (filter === 'yesterday') {
      whereClause += ` AND created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE`;
    } else if (filter === 'week') {
      whereClause += ` AND created_at >= DATE_TRUNC('week', CURRENT_DATE)`;
    } else if (filter === 'month') {
      whereClause += ` AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (filter === 'particular_day' && date) {
      whereClause += ` AND created_at::date = $5`;
      params.push(date);
    } else if (filter === 'particular_month' && month) {
      whereClause += ` AND TO_CHAR(created_at, 'YYYY-MM') = $5`;
      params.push(month);
    } else if (filter === 'range' && req.body.startDate && req.body.endDate) {
      whereClause += ` AND created_at::date >= $5 AND created_at::date <= $6`;
      params.push(req.body.startDate, req.body.endDate);
    }

    if (currentStatus) {
      if (currentStatus === 'pending') {
        whereClause += ` AND status IN ('Review', 'Pending')`;
      } else if (currentStatus === 'approved') {
        whereClause += ` AND status = 'Approved'`;
      } else if (currentStatus === 'rejected') {
        whereClause += ` AND status = 'Rejected'`;
      }
    }



    const updateQuery = `
      UPDATE petitions
      SET status = $1, remarks = $2, reviewed_by = $3, updated_at = CURRENT_TIMESTAMP
      ${whereClause}
      RETURNING petition_id
    `;

    const result = await pool.query(updateQuery, params);
    res.json({ success: true, count: result.rowCount, updatedIds: result.rows.map(r => r.petition_id) });
  } catch (error) {
    console.error("Error batch updating petitions:", error);
    res.status(500).json({ error: error.message });
  }
});


app.post("/api/complaints", authenticateToken, async (req, res) => {
  try {
    const {
      community_id,
      title,
      description,
      category,
      severity = 'medium',
      is_urgent = false,
      visibility = 'public',
      allow_follow_up = false,
      preferred_contact_channel = 'chat',
      contact_email,
      contact_phone,
      tags,
    } = req.body;

    const created_by = req.user.user_id;

    if (!community_id || !title || !description || !category) {
      return res.status(400).json({
        error: 'Missing required fields: community_id, title, description, category',
      });
    }

    const validCategories = ['infrastructure', 'cleanliness', 'safety', 'food', 'noise', 'finance', 'behavior', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    const memberCheck = await pool.query(
      `SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [created_by, community_id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You must be an active member of this community' });
    }

    const textToAnalyze = `${title}\n\n${description}`;
    let nlpAnalysis = null;
    try {
      nlpAnalysis = await analyzeContentWithLLM(textToAnalyze, 'complaint');
      nlpAnalysis = {
        sentiment: nlpAnalysis.sentiment,
        toxicity: nlpAnalysis.toxicity,
        llmSummary: nlpAnalysis.llmSummary,
        llmVerdict: nlpAnalysis.llmVerdict,
        processingTime: nlpAnalysis.processingTime,
      };
    } catch (nlpErr) {
      logger.warn('NLP/LLM analysis failed for complaint, storing without analysis', { error: nlpErr.message });
    }

    const result = await pool.query(
      `INSERT INTO complaints (
        community_id, created_by, title, description, category,
        severity, is_urgent, visibility, allow_follow_up,
        preferred_contact_channel, contact_email, contact_phone, tags, nlp_analysis
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        community_id, created_by, title, description, category,
        severity, is_urgent, visibility, allow_follow_up,
        preferred_contact_channel, contact_email || null, contact_phone || null,
        tags || [], nlpAnalysis ? JSON.stringify(nlpAnalysis) : null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complaint detail (must be before /:communityId)
app.get("/api/complaints/detail/:complaintId", authenticateToken, async (req, res) => {
  try {
    const complaintId = parseInt(req.params.complaintId, 10);
    if (isNaN(complaintId)) return res.status(400).json({ error: "Invalid complaint ID" });
    const result = await pool.query(
      `SELECT c.*, u.full_name as creator_name
       FROM complaints c
       JOIN users u ON c.created_by = u.user_id
       WHERE c.complaint_id = $1`,
      [complaintId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Complaint not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching complaint detail:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/complaints/:complaintId", authenticateToken, async (req, res) => {
  try {
    const complaintId = parseInt(req.params.complaintId, 10);
    if (isNaN(complaintId)) return res.status(400).json({ error: "Invalid complaint ID" });

    const complaintRes = await pool.query(
      `SELECT complaint_id, community_id, created_by FROM complaints WHERE complaint_id = $1`,
      [complaintId]
    );
    if (complaintRes.rows.length === 0) return res.status(404).json({ error: "Complaint not found" });

    const { community_id, created_by } = complaintRes.rows[0];
    const userId = req.user?.user_id;

    const membershipRes = await pool.query(
      `SELECT role FROM memberships
       WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE' LIMIT 1`,
      [userId, community_id]
    );
    if (membershipRes.rows.length === 0) {
      return res.status(403).json({ error: "You must be an active member of this community" });
    }
    const role = membershipRes.rows[0].role;
    if (created_by !== userId && !["HEAD", "ADMIN"].includes(role)) {
      return res.status(403).json({ error: "Only the creator or admins can delete this complaint" });
    }

    await pool.query(`DELETE FROM complaints WHERE complaint_id = $1`, [complaintId]);
    res.json({ success: true, message: "Complaint deleted successfully" });
  } catch (error) {
    console.error("Error deleting complaint:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/complaints/:communityId", authenticateToken, async (req, res) => {
  try {
    const { communityId } = req.params;
    const { filter } = req.query;

    let query = `
      SELECT c.*, u.full_name as creator_name
      FROM complaints c
      JOIN users u ON c.created_by = u.user_id
      WHERE c.community_id = $1
    `;
    const params = [communityId];

    if (filter === 'today') {
      query += ` AND c.created_at >= CURRENT_DATE`;
    } else if (filter === 'yesterday') {
      query += ` AND c.created_at >= CURRENT_DATE - INTERVAL '1 day' AND c.created_at < CURRENT_DATE`;
    } else if (filter === 'month') {
      query += ` AND c.created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (filter === 'particular_day' && req.query.date) {
      query += ` AND c.created_at::date = $2`;
      params.push(req.query.date);
    } else if (filter === 'particular_month' && req.query.month) {
      query += ` AND TO_CHAR(c.created_at, 'YYYY-MM') = $2`;
      params.push(req.query.month);
    }

    query += ` ORDER BY c.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI process complaint
app.post("/api/complaints/:complaintId/ai-process", authenticateToken, async (req, res) => {
  try {
    const complaintId = parseInt(req.params.complaintId, 10);
    if (isNaN(complaintId)) return res.status(400).json({ error: "Invalid complaint ID" });

    const complaintRes = await pool.query(
      `SELECT c.*, u.full_name as creator_name 
       FROM complaints c 
       JOIN users u ON c.created_by = u.user_id
       WHERE c.complaint_id = $1`,
      [complaintId]
    );

    if (complaintRes.rows.length === 0) return res.status(404).json({ error: "Complaint not found" });
    const complaint = complaintRes.rows[0];

    // Check permissions
    const userId = req.user.user_id;
    const membershipRes = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [userId, complaint.community_id]
    );

    if (membershipRes.rows.length === 0 || !['HEAD', 'ADMIN'].includes(membershipRes.rows[0].role)) {
      return res.status(403).json({ error: "Only admins can trigger AI processing" });
    }

    const textToAnalyze = `${complaint.title}\n\n${complaint.description}`;
    const analysis = await analyzeContentWithLLM(textToAnalyze, 'complaint');

    let newStatus = 'OPEN';
    let remarks = `AI-generated verdict: ${analysis.llmVerdict}. ${analysis.llmSummary || ''}`;

    if (analysis.llmVerdict === 'POSITIVE') {
      newStatus = 'Approved';
    } else if (analysis.llmVerdict === 'NEGATIVE') {
      newStatus = 'Rejected';
    } else {
      newStatus = 'Pending';
    }

    const updateRes = await pool.query(
      `UPDATE complaints 
       SET status = $1, remarks = $2, reviewed_by = $3, nlp_analysis = $4, updated_at = CURRENT_TIMESTAMP
       WHERE complaint_id = $5 
       RETURNING *`,
      [newStatus, remarks, userId, JSON.stringify(analysis), complaintId]
    );

    res.json({
      success: true,
      status: newStatus,
      analysis: analysis,
      complaint: updateRes.rows[0]
    });

  } catch (error) {
    console.error('Error AI processing complaint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update complaint status (HEAD only)
app.put("/api/complaints/:complaintId/status", authenticateToken, async (req, res) => {
  try {
    const complaintId = parseInt(req.params.complaintId, 10);
    if (isNaN(complaintId)) return res.status(400).json({ error: "Invalid complaint ID" });

    const { status, remarks = "" } = req.body || {};
    const allowedStatuses = new Set(["Pending", "Approved", "Rejected", "Resolved", "Dismissed", "InProgress"]);

    if (!status || typeof status !== "string" || !allowedStatuses.has(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${Array.from(allowedStatuses).join(", ")}`,
      });
    }

    const complaintRes = await pool.query(
      `SELECT complaint_id, community_id FROM complaints WHERE complaint_id = $1`,
      [complaintId]
    );
    if (complaintRes.rows.length === 0) return res.status(404).json({ error: "Complaint not found" });

    const communityId = complaintRes.rows[0].community_id;
    const userId = req.user?.user_id;

    const membershipRes = await pool.query(
      `SELECT role
       FROM memberships
       WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'
       LIMIT 1`,
      [userId, communityId]
    );

    if (membershipRes.rows.length === 0) {
      return res.status(403).json({ error: "You must be an active member of this community" });
    }

    const role = membershipRes.rows[0].role;
    if (!["HEAD", "ADMIN"].includes(role)) {
      return res.status(403).json({ error: "Only admins can update complaint status" });
    }

    const updateRes = await pool.query(
      `UPDATE complaints
       SET status = $1,
           remarks = $2,
           reviewed_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE complaint_id = $4
       RETURNING *`,
      [status, String(remarks || ""), userId, complaintId]
    );

    res.json(updateRes.rows[0]);
  } catch (error) {
    console.error("Error updating complaint status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Batch update complaint status
app.post("/api/complaints/batch-status", authenticateToken, async (req, res) => {
  try {
    const { communityId, status, filter, date, month, currentStatus, remarks = "Batch update" } = req.body;
    const userId = req.user?.user_id;

    if (!communityId || !status) {
      return res.status(400).json({ error: "communityId and status are required" });
    }

    const allowedStatuses = new Set(["Pending", "Approved", "Rejected"]);
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }


    // Role check
    const membershipRes = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE' LIMIT 1`,
      [userId, communityId]
    );
    if (membershipRes.rows.length === 0 || !["HEAD", "ADMIN"].includes(membershipRes.rows[0].role)) {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    let whereClause = "WHERE community_id = $4";
    const params = [status, remarks, userId, communityId];

    if (filter === 'today') {
      whereClause += ` AND created_at >= CURRENT_DATE`;
    } else if (filter === 'yesterday') {
      whereClause += ` AND created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE`;
    } else if (filter === 'week') {
      whereClause += ` AND created_at >= DATE_TRUNC('week', CURRENT_DATE)`;
    } else if (filter === 'month') {
      whereClause += ` AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (filter === 'particular_day' && date) {
      whereClause += ` AND created_at::date = $5`;
      params.push(date);
    } else if (filter === 'particular_month' && month) {
      whereClause += ` AND TO_CHAR(created_at, 'YYYY-MM') = $5`;
      params.push(month);
    } else if (filter === 'range' && req.body.startDate && req.body.endDate) {
      whereClause += ` AND created_at::date >= $5 AND created_at::date <= $6`;
      params.push(req.body.startDate, req.body.endDate);
    }

    if (currentStatus) {
      const upperStatus = currentStatus.toUpperCase();
      if (upperStatus === 'PENDING') {
        whereClause += ` AND status IN ('OPEN', 'PENDING', 'REVIEW', 'IN_PROGRESS', 'INPROGRESS')`;
      } else {
        whereClause += ` AND status = '${upperStatus}'`;
      }
    }



    const updateQuery = `
      UPDATE complaints
      SET status = $1, remarks = $2, reviewed_by = $3, updated_at = CURRENT_TIMESTAMP
      ${whereClause}
      RETURNING complaint_id
    `;

    const result = await pool.query(updateQuery, params);
    res.json({ success: true, count: result.rowCount, updatedIds: result.rows.map(r => r.complaint_id) });
  } catch (error) {
    console.error("Error batch updating complaints:", error);
    res.status(500).json({ error: error.message });
  }
});


// Get user's role in a community
app.get("/api/community/:communityId/my-role", authenticateToken, async (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId, 10);
    if (isNaN(communityId)) return res.status(400).json({ error: "Invalid community ID" });

    const userId = req.user?.user_id;

    const membershipRes = await pool.query(
      `SELECT role
       FROM memberships
       WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'
       LIMIT 1`,
      [userId, communityId]
    );

    if (membershipRes.rows.length === 0) {
      return res.json({ role: null });
    }

    res.json({ role: membershipRes.rows[0].role });
  } catch (error) {
    console.error("Error fetching user role:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================================================
// POLLS & VOTING ENDPOINTS
// ========================================================================

// Create a new poll in a community (HEAD only)
app.post("/api/communities/:communityId/polls", authenticateToken, async (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId, 10);
    if (Number.isNaN(communityId)) {
      return res.status(400).json({ error: "Invalid community ID" });
    }

    const userId = req.user.user_id;
    const perm = await requireHeadRole(userId, communityId);
    if (!perm.ok) {
      return res.status(403).json({ error: perm.error });
    }

    const {
      title,
      description,
      options,
      allowMultipleAnswers,
      duration,
      resultVisibility,
      votingRequirement,
      allowChangeVote,
      showVoterCount,
      anonymousVoting,
      requireComment,
      minVotesToShow,
      allowSuggestions,
    } = req.body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Poll title is required" });
    }

    if (!Array.isArray(options)) {
      return res.status(400).json({ error: "Options array is required" });
    }

    const trimmedOptions = options
      .map((opt) => (typeof opt === "string" ? opt.trim() : ""))
      .filter((opt) => opt.length > 0);

    if (trimmedOptions.length < 2) {
      return res.status(400).json({ error: "At least 2 non-empty options are required" });
    }

    if (trimmedOptions.length > 10) {
      return res.status(400).json({ error: "Maximum 10 options allowed" });
    }

    // Map duration code from UI to DB field
    const allowedDurations = new Set(["1h", "6h", "1d", "3d", "7d", "30d", "unlimited"]);
    const durationCode = allowedDurations.has(duration) ? duration : "7d";

    // Map result visibility
    const allowedResultVisibility = new Set(["immediate", "after_vote", "after_close"]);
    const resultVisibilityDb = allowedResultVisibility.has(resultVisibility)
      ? resultVisibility
      : "after_vote";

    // Map voting requirement from UI ('none' | 'verified' | 'tenure')
    let votingRequirementDb = "everyone";
    if (votingRequirement === "verified") {
      votingRequirementDb = "heads_only";
    } else if (votingRequirement === "tenure") {
      votingRequirementDb = "tenure";
    }

    const minVotes = Number.isFinite(Number(minVotesToShow))
      ? Math.max(0, parseInt(minVotesToShow, 10))
      : 0;

    // Compute closes_at based on duration
    let closesAt = null;
    if (durationCode !== "unlimited") {
      const now = new Date();
      const closes = new Date(now);
      switch (durationCode) {
        case "1h":
          closes.setHours(closes.getHours() + 1);
          break;
        case "6h":
          closes.setHours(closes.getHours() + 6);
          break;
        case "1d":
          closes.setDate(closes.getDate() + 1);
          break;
        case "3d":
          closes.setDate(closes.getDate() + 3);
          break;
        case "7d":
          closes.setDate(closes.getDate() + 7);
          break;
        case "30d":
          closes.setDate(closes.getDate() + 30);
          break;
        default:
          break;
      }
      closesAt = closes.toISOString();
    }

    // Insert poll
    const pollResult = await pool.query(
      `INSERT INTO polls (
        community_id,
        created_by,
        title,
        description,
        allow_multiple_answers,
        allow_change_vote,
        allow_suggestions,
        require_comment,
        visibility,
        result_visibility,
        voting_requirement,
        show_voter_count,
        anonymous_voting,
        min_votes_to_show,
        duration_code,
        closes_at,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'public',$9,$10,$11,$12,$13,$14,$15,TRUE)
      RETURNING poll_id, community_id, created_by, title, description, duration_code, closes_at, created_at`,
      [
        communityId,
        userId,
        title.trim(),
        description && typeof description === "string" ? description.trim() : null,
        !!allowMultipleAnswers,
        allowChangeVote !== false,
        !!allowSuggestions,
        !!requireComment,
        resultVisibilityDb,
        votingRequirementDb,
        showVoterCount !== false,
        !!anonymousVoting,
        minVotes,
        durationCode,
        closesAt,
      ]
    );

    const poll = pollResult.rows[0];

    // Insert options
    const values = [];
    const params = [];
    trimmedOptions.forEach((label, index) => {
      const position = index + 1;
      params.push(poll.poll_id, label, position);
      const baseIndex = index * 3;
      values.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`);
    });

    await pool.query(
      `INSERT INTO poll_options (poll_id, label, position) VALUES ${values.join(",")}`,
      params
    );

    // Fetch options for response
    const optionsResult = await pool.query(
      `SELECT option_id, label, position
       FROM poll_options
       WHERE poll_id = $1
       ORDER BY position ASC`,
      [poll.poll_id]
    );

    res.status(201).json({
      poll,
      options: optionsResult.rows,
    });
  } catch (error) {
    console.error("Error creating poll:", error);
    res.status(500).json({ error: "Failed to create poll" });
  }
});

// Get all polls in a community (Member/Admin)
app.get("/api/communities/:communityId/polls", authenticateToken, async (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId, 10);
    if (isNaN(communityId)) return res.status(400).json({ error: "Invalid community ID" });

    const userId = req.user.user_id;

    // Verify membership
    const membership = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [userId, communityId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: "Not a community member" });
    }

    const result = await pool.query(
      `SELECT p.*, u.full_name as creator_name,
              (SELECT COUNT(DISTINCT user_id) FROM poll_votes WHERE poll_id = p.poll_id) as total_voters,
              CASE WHEN p.closes_at < CURRENT_TIMESTAMP THEN FALSE ELSE p.is_active END as effectively_active
       FROM polls p
       LEFT JOIN users u ON p.created_by = u.user_id
       WHERE p.community_id = $1
       ORDER BY p.created_at DESC`,
      [communityId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching polls:", error);
    res.status(500).json({ error: "Failed to fetch polls" });
  }
});

// Get specific poll details (Member/Admin)
app.get("/api/communities/:communityId/polls/:pollId", authenticateToken, async (req, res) => {
  try {
    const { communityId, pollId } = req.params;
    const userId = req.user.user_id;

    // Verify membership
    const membership = await pool.query(
      `SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [userId, communityId]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: "Not a community member" });
    }

    const pollResult = await pool.query(
      `SELECT p.*, u.full_name as creator_name,
              (SELECT COUNT(DISTINCT user_id) FROM poll_votes WHERE poll_id = p.poll_id) as total_voters,
              CASE WHEN p.closes_at < CURRENT_TIMESTAMP THEN FALSE ELSE p.is_active END as effectively_active
       FROM polls p
       LEFT JOIN users u ON p.created_by = u.user_id
       WHERE p.poll_id = $1 AND p.community_id = $2`,
      [pollId, communityId]
    );

    if (pollResult.rows.length === 0) {
      return res.status(404).json({ error: "Poll not found" });
    }

    const poll = pollResult.rows[0];

    // Fetch options with vote counts
    const optionsResult = await pool.query(
      `SELECT po.*, 
              (SELECT COUNT(*) FROM poll_votes WHERE poll_id = po.poll_id AND option_id = po.option_id) as vote_count
       FROM poll_options po
       WHERE po.poll_id = $1
       ORDER BY po.position ASC`,
      [pollId]
    );

    const totalVotes = optionsResult.rows.reduce((sum, opt) => sum + parseInt(opt.vote_count || 0), 0);
    const options = optionsResult.rows.map(opt => ({
      ...opt,
      vote_percentage: totalVotes > 0 ? (parseInt(opt.vote_count) / totalVotes) * 100 : 0
    }));

    // Fetch user's votes for this poll
    const myVotesResult = await pool.query(
      `SELECT option_id FROM poll_votes WHERE poll_id = $1 AND user_id = $2`,
      [pollId, userId]
    );

    res.json({
      ...poll,
      options,
      my_voted_option_ids: myVotesResult.rows.map(r => r.option_id)
    });
  } catch (error) {
    console.error("Error fetching poll details:", error);
    res.status(500).json({ error: "Failed to fetch poll details" });
  }
});

// Get current user's vote for a poll
app.get("/api/communities/:communityId/polls/:pollId/my-vote", authenticateToken, async (req, res) => {
  try {
    const { pollId } = req.params;
    const userId = req.user.user_id;

    const result = await pool.query(
      `SELECT option_id, comment FROM poll_votes WHERE poll_id = $1 AND user_id = $2`,
      [pollId, userId]
    );

    res.json({
      hasVoted: result.rows.length > 0,
      votes: result.rows
    });
  } catch (error) {
    console.error("Error fetching user vote:", error);
    res.status(500).json({ error: "Failed to fetch your vote" });
  }
});

// Vote in a poll
app.post("/api/communities/:communityId/polls/:pollId/vote", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { communityId, pollId } = req.params;
    const { optionIds, option_ids, comment } = req.body;
    const actualOptionIds = option_ids || optionIds;
    const userId = req.user.user_id;

    if (!Array.isArray(actualOptionIds) || actualOptionIds.length === 0) {
      return res.status(400).json({ error: "At least one option must be selected" });
    }

    await client.query("BEGIN");

    // 1. Fetch poll settings and status
    const pollResult = await client.query(
      `SELECT * FROM polls WHERE poll_id = $1 AND community_id = $2`,
      [pollId, communityId]
    );

    if (pollResult.rows.length === 0) {
      throw new Error("Poll not found");
    }

    const poll = pollResult.rows[0];

    // Check if poll is active
    if (!poll.is_active || (poll.closes_at && new Date(poll.closes_at) < new Date())) {
      return res.status(400).json({ error: "This poll is no longer active" });
    }

    // Check multiple answers setting
    if (!poll.allow_multiple_answers && actualOptionIds.length > 1) {
      return res.status(400).json({ error: "Multiple answers are not allowed for this poll" });
    }

    // Check if user has already voted
    const existingVote = await client.query(
      `SELECT vote_id FROM poll_votes WHERE poll_id = $1 AND user_id = $2 LIMIT 1`,
      [pollId, userId]
    );

    if (existingVote.rows.length > 0) {
      if (!poll.allow_change_vote) {
        return res.status(400).json({ error: "Vote changes are not allowed for this poll" });
      }
      // Delete old votes if change is allowed
      await client.query(
        `DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2`,
        [pollId, userId]
      );
    }

    // Check comment requirement
    if (poll.require_comment && (!comment || !comment.trim())) {
      return res.status(400).json({ error: "A comment is required for this poll" });
    }

    // 2. Insert new votes
    const insertValues = [];
    const insertParams = [];
    actualOptionIds.forEach((oid, idx) => {
      const base = idx * 4;
      insertParams.push(pollId, userId, oid, comment || null);
      insertValues.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
    });

    await client.query(
      `INSERT INTO poll_votes (poll_id, user_id, option_id, comment) VALUES ${insertValues.join(",")}`,
      insertParams
    );

    // 3. Automatic Poll Closing Check
    // Get total number of active members in the community (excluding HEAD/ADMIN)
    const membersCountResult = await client.query(
      `SELECT COUNT(*) as member_count FROM memberships 
       WHERE community_id = $1 AND role = 'MEMBER' AND status = 'ACTIVE'`,
      [communityId]
    );
    const totalMembers = parseInt(membersCountResult.rows[0].member_count, 10);

    // Get number of unique members who have voted on this poll
    const voterCountRes = await client.query(
      `SELECT COUNT(DISTINCT pv.user_id) as voter_count FROM poll_votes pv
       JOIN memberships m ON pv.user_id = m.user_id 
       WHERE pv.poll_id = $1 
       AND m.community_id = $2 
       AND m.role = 'MEMBER' 
       AND m.status = 'ACTIVE'`,
      [pollId, communityId]
    );
    const totalVoters = parseInt(voterCountRes.rows[0].voter_count, 10);

    let autoClosed = false;
    // Only auto-close if there are members and all have voted
    if (totalMembers > 0 && totalVoters >= totalMembers) {
      await client.query(
        `UPDATE polls SET is_active = FALSE, closes_at = CURRENT_TIMESTAMP, closed_at = CURRENT_TIMESTAMP 
         WHERE poll_id = $1`,
        [pollId]
      );
      autoClosed = true;
    }

    await client.query("COMMIT");

    // Trigger re-fetch for all clients or broadcast update
    // We broadcast to the community room
    io.to(`community_${communityId}`).emit('poll_updated', {
      pollId,
      status: autoClosed ? 'closed' : 'updated'
    });

    res.json({
      success: true,
      message: autoClosed ? "Vote cast and poll automatically closed" : "Vote cast successfully"
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error casting vote:", error);
    res.status(error.message === "Poll not found" ? 404 : 500).json({ error: error.message || "Failed to cast vote" });
  } finally {
    client.release();
  }
});

// Close a poll manually (HEAD only)
app.patch("/api/communities/:communityId/polls/:pollId/close", authenticateToken, async (req, res) => {
  try {
    const { communityId, pollId } = req.params;
    const userId = req.user.user_id;

    const perm = await requireHeadRole(userId, communityId);
    if (!perm.ok) {
      return res.status(403).json({ error: perm.error });
    }

    const result = await pool.query(
      `UPDATE polls SET is_active = FALSE, closes_at = CURRENT_TIMESTAMP 
       WHERE poll_id = $1 AND community_id = $2
       RETURNING poll_id`,
      [pollId, communityId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Poll not found" });
    }

    io.to(`community_${communityId}`).emit('poll_updated', { pollId, status: 'closed' });

    res.json({ success: true, message: "Poll closed successfully" });
  } catch (error) {
    console.error("Error closing poll:", error);
    res.status(500).json({ error: "Failed to close poll" });
  }
});



// ========================================================================
// EVENTS CRUD
// ========================================================================

async function requireHeadRole(userId, communityId) {
  const roleRes = await pool.query(
    `SELECT role, status
     FROM memberships
     WHERE user_id = $1 AND community_id = $2
     LIMIT 1`,
    [userId, communityId]
  );
  if (roleRes.rows.length === 0 || roleRes.rows[0].status !== 'ACTIVE') {
    return { ok: false, error: 'You must be an active member of this community' };
  }
  const role = String(roleRes.rows[0].role || '').trim().toUpperCase();
  if (role !== 'HEAD') {
    return { ok: false, error: 'Unauthorized: Only community heads can manage events' };
  }
  return { ok: true };
}

// POST: Create Event (JSON body; attachment_url optional)
app.post("/api/communities/:communityId/events", authenticateToken, async (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId, 10);
    if (Number.isNaN(communityId)) return res.status(400).json({ error: "Invalid community ID" });

    const userId = req.user.user_id;
    const perm = await requireHeadRole(userId, communityId);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const {
      title,
      content,
      effective_from,
      valid_until,
      applicable_to,
      attachment_url,
      attachment_type,
      isPinned,
      isImportant,
    } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({ error: "Missing required fields: title, content" });
    }

    const result = await pool.query(
      `INSERT INTO events (
        community_id, title, content, effective_from, valid_until, applicable_to,
        attachment_url, attachment_type, created_by, posted_by, is_pinned, is_important
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        communityId,
        title,
        content,
        effective_from || null,
        valid_until || null,
        applicable_to || null,
        attachment_url || null,
        attachment_type || null,
        userId, // created_by
        userId, // posted_by
        isPinned || false,
        isImportant || false
      ]
    );

    io.to(`community_${communityId}`).emit('new_event_alert', {
      title,
      message: "New event posted!",
      event: result.rows[0],
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET: List Events (members can view)
app.get("/api/communities/:communityId/events", authenticateToken, async (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId, 10);
    if (Number.isNaN(communityId)) return res.status(400).json({ error: "Invalid community ID" });

    // membership check (ACTIVE)
    const memberRes = await pool.query(
      `SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
      [req.user.user_id, communityId]
    );
    if (memberRes.rows.length === 0) {
      return res.status(403).json({ error: "You must be an active member of this community" });
    }

    const result = await pool.query(
      `SELECT e.*, u.full_name as organizer_name
       FROM events e
       LEFT JOIN users u ON e.posted_by = u.user_id
       WHERE e.community_id = $1
       ORDER BY COALESCE(e.effective_from, e.created_at::date) ASC, e.created_at ASC`,
      [communityId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error listing events:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT: Update Event (HEAD only)
app.put("/api/communities/:communityId/events/:eventId", authenticateToken, async (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId, 10);
    const eventId = parseInt(req.params.eventId, 10);
    if (Number.isNaN(communityId) || Number.isNaN(eventId)) {
      return res.status(400).json({ error: "Invalid communityId or eventId" });
    }

    const userId = req.user.user_id;
    const perm = await requireHeadRole(userId, communityId);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const {
      title,
      content,
      effective_from,
      valid_until,
      applicable_to,
      attachment_url,
      attachment_type,
    } = req.body || {};

    const result = await pool.query(
      `UPDATE events
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           effective_from = $3,
           valid_until = $4,
           applicable_to = $5,
           attachment_url = $6,
           attachment_type = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE event_id = $8 AND community_id = $9
       RETURNING *`,
      [
        title ?? null,
        content ?? null,
        effective_from || null,
        valid_until || null,
        applicable_to || null,
        attachment_url || null,
        attachment_type || null,
        eventId,
        communityId,
      ]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "Event not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Delete Event (HEAD only)
app.delete("/api/communities/:communityId/events/:eventId", authenticateToken, async (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId, 10);
    const eventId = parseInt(req.params.eventId, 10);
    if (Number.isNaN(communityId) || Number.isNaN(eventId)) {
      return res.status(400).json({ error: "Invalid communityId or eventId" });
    }

    const userId = req.user.user_id;
    const perm = await requireHeadRole(userId, communityId);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const del = await pool.query(
      `DELETE FROM events WHERE event_id = $1 AND community_id = $2`,
      [eventId, communityId]
    );
    if (del.rowCount === 0) return res.status(404).json({ error: "Event not found" });
    res.json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/communities/:communityId/sos", authenticateToken, async (req, res) => {
  // Your existing SOS alert code
  // ... (copy from your original server.js)
});

// ========================================================================
// SOCKET.IO HANDLERS
// ========================================================================

// Socket.io authentication middleware for NLP moderation
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    socket.userId = decoded.user_id || decoded.userId;
    socket.communityId = decoded.communityId;
    socket.role = decoded.role;

    next();
  } catch (error) {
    logger.warn('Socket.io authentication failed', { error: error.message });
    next(new Error('Invalid token'));
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  logger.info('Socket.io client connected', {
    socketId: socket.id,
    userId: socket.userId,
    communityId: socket.communityId,
  });

  // Join community room
  socket.on('join_community', (communityId) => {
    socket.join(`community_${communityId}`);
    connectedUsers.set(socket.id, communityId);

    if (socket.communityId) {
      socket.join(`community:${socket.communityId}`);
    }

    const roomSize = io.sockets.adapter.rooms.get(`community_${communityId}`)?.size || 0;
    logger.info(`Socket joined community`, {
      socketId: socket.id,
      communityId,
      roomSize,
    });
  });

  // Leave community room
  socket.on('leave_community', (communityId) => {
    socket.leave(`community_${communityId}`);
    logger.info(`Socket left community`, {
      socketId: socket.id,
      communityId,
    });
  });

  // ✅ NLP Real-time message moderation
  socket.on('moderate:message', async (data) => {
    try {
      const { text, messageType = 'chat' } = data;

      if (!text || typeof text !== 'string') {
        socket.emit('moderation:error', {
          error: 'Invalid message text',
        });
        return;
      }

      // Moderate content using NLP service
      const result = await nlpModerateContent(
        text,
        socket.communityId,
        socket.userId,
        messageType
      );

      // Send result back to sender
      socket.emit('moderation:result', {
        approved: result.approved,
        action: result.action,
        reason: result.reason,
        holdId: result.holdId,
      });

      // If quarantined, notify moderators in the community
      if (result.action === 'quarantined') {
        io.to(`community:${socket.communityId}`)
          .emit('moderation:flag', {
            holdId: result.holdId,
            userId: socket.userId,
            messageType,
            timestamp: new Date().toISOString(),
          });

        logger.info('Real-time moderation flag sent', {
          holdId: result.holdId,
          communityId: socket.communityId,
        });
      }

    } catch (error) {
      logger.error('Socket.io moderation error', {
        error: error.message,
        socketId: socket.id,
      });

      socket.emit('moderation:error', {
        error: 'Moderation failed',
      });
    }
  });

  // Admin review notification
  socket.on('admin:review', async (data) => {
    try {
      if (!['admin', 'moderator', 'HEAD'].includes(socket.role)) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      const { holdId, decision } = data;

      io.to(`community:${socket.communityId}`)
        .emit('moderation:reviewed', {
          holdId,
          decision,
          reviewedBy: socket.userId,
          timestamp: new Date().toISOString(),
        });

      logger.info('Admin review broadcasted', {
        holdId,
        decision,
        adminId: socket.userId,
      });

    } catch (error) {
      logger.error('Admin review broadcast error', { error: error.message });
    }
  });

  // Disconnect handler
  socket.on('disconnect', (reason) => {
    const communityId = connectedUsers.get(socket.id);
    logger.info('Socket.io client disconnected', {
      socketId: socket.id,
      userId: socket.userId,
      reason,
    });
    if (communityId) {
      const roomSize = io.sockets.adapter.rooms.get(`community_${communityId}`)?.size || 0;
      logger.info(`Remaining in community`, { communityId, roomSize });
    }
    connectedUsers.delete(socket.id);
  });

  // Error handler
  socket.on('error', (error) => {
    logger.error('Socket.io error', {
      socketId: socket.id,
      error: error.message,
    });
  });
});

// ========================================================================
// 404 & ERROR HANDLERS
// ========================================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
  });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
});

// ========================================================================
// SERVER STARTUP
// ========================================================================

async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    logger.info('✅ PostgreSQL connected');

    // Test Redis connection (if NLP service enabled)
    try {
      await redis.ping();
      logger.info('✅ Redis connected (NLP service available)');
    } catch (redisError) {
      logger.warn('⚠️  Redis not available (NLP caching disabled)');
    }

    // Preload NLP models (optional)
    if (process.env.PRELOAD_MODELS === 'true') {
      logger.info('Preloading NLP models...');
      await preloadModels();
    }

    // Start server
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Civix Platform running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Accessible at http://localhost:${PORT} (local)`);
      logger.info(`Socket.io enabled for real-time features`);
      logger.info(`NLP ChatBot service: ${process.env.NLP_ENABLED === 'true' ? 'ENABLED' : 'OPTIONAL'}`);
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// ========================================================================
// GRACEFUL SHUTDOWN
// ========================================================================

async function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully...`);

  server.close(async () => {
    try {
      await pool.end();
      try {
        await redis.quit();
      } catch (e) {
        // Redis might not be connected
      }
      logger.info('✅ All connections closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    reason,
    promise,
  });
});

// Start the server
startServer();

module.exports = { app, server, io, pool };

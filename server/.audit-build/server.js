// src/configs/dotenv.config.ts
import dotenv from "dotenv";
var dotenv_config_default = dotenv.config();

// src/app.ts
import express5 from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import cors from "cors";
import path from "path";
import helmet from "helmet";

// src/utils/envHandler.ts
var getEnv = (key, required = true) => {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};
var envHandler_default = getEnv;

// src/constants/app.constants.ts
var NODE_ENV = envHandler_default("NODE_ENV");
var PORT = parseInt(envHandler_default("PORT"), 10) || 3e3;
var HOST = envHandler_default("HOST", false);
var FRONTEND_URL = envHandler_default("FRONTEND_URL");
var DATABASE_URL = envHandler_default("DATABASE_URL");
var DIRECT_URL = envHandler_default("DIRECT_URL");
var ALLOWED_ORIGINS = envHandler_default("ALLOWED_ORIGINS");

// src/v1/middlewares/error.middleware.ts
var errorHandler = (err, req, res) => {
  const statusCode = err.statusCode ?? res.statusCode ?? 500;
  const response = {
    success: false,
    message: NODE_ENV === "DEVELOPMENT" ? err.message : "Something went wrong. Please try again later.",
    ...NODE_ENV === "DEVELOPMENT" && {
      stack: err.stack
    }
  };
  return res.status(statusCode).json(response);
};
var notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// src/v1/middlewares/cacheControl.middleware.ts
var cacheControl = (req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("X-API-Version", "1.0");
  res.setHeader("X-Request-ID", req.headers["x-request-id"] ?? "unknown");
  next();
};

// src/v1/routes/user.routes.ts
import express from "express";

// src/configs/prisma.config.ts
import { PrismaClient } from "@prisma/client";
var prisma = new PrismaClient();
var originalTransaction = prisma.$transaction.bind(
  prisma
);
prisma.$transaction = function(queries, options) {
  const startTime = Date.now();
  return originalTransaction(queries, {
    ...options,
    timeout: 3e4
  }).then((result) => {
    const duration = Date.now() - startTime;
    if (duration > 1e4) {
      console.warn(`SLOW TRANSACTION: ${duration}ms`, {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        duration,
        action: "transaction"
      });
    }
    return result;
  }).catch((error) => {
    const duration = Date.now() - startTime;
    console.error(`TRANSACTION FAILED: ${duration}ms`, {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      duration,
      error: error.message,
      code: error.code
    });
    throw error;
  });
};
prisma.$on("query", (e) => {
  if (e.duration > 1e4) {
    console.warn(`SLOW QUERY: ${e.duration}ms`, {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      query: e.query,
      params: e.params,
      duration: e.duration
    });
  }
});
var prisma_config_default = prisma;

// src/v1/repositories/user.repository.ts
var findUserById = async (user_id) => {
  return await prisma_config_default.user.findUnique({
    where: { id: user_id },
    include: {
      student: true
    }
  });
};
var onboardUser = async (user_id, department, program) => {
  const user2 = await prisma_config_default.user.update({
    where: { id: user_id },
    data: {
      done_onboarding: true,
      student: {
        update: {
          department,
          program
        }
      }
    },
    select: {
      id: true,
      done_onboarding: true,
      umindanao_email: true,
      role: true,
      student: true
    }
  });
  if (!user2) {
    return null;
  }
  return user2;
};
var getUserAttendedEvents = async (student_id) => {
  const attendedEvents = await prisma_config_default.attendance.findMany({
    where: {
      student_id
    },
    select: {
      event: {
        select: {
          id: true,
          title: true,
          start_time: true,
          end_time: true
        }
      }
    },
    orderBy: {
      event: {
        start_time: "desc"
      }
    }
  });
  return attendedEvents.map((record) => ({
    ...record.event
  }));
};
var getUserAttendedEventsDetailed = async (student_id) => {
  const student = await prisma_config_default.student.findUnique({
    where: { student_id },
    select: { id: true }
  });
  if (!student) {
    return [];
  }
  const attendedEvents = await prisma_config_default.attendance.findMany({
    where: {
      student_id
    },
    select: {
      event: {
        select: {
          id: true,
          title: true,
          start_time: true,
          end_time: true,
          check_out_required: true,
          created_by: true,
          user: {
            select: {
              student: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: {
      event: {
        start_time: "desc"
      }
    }
  });
  return attendedEvents.map((record) => ({
    id: record.event.id,
    title: record.event.title,
    created_by: record.event.user.student?.name ?? "Unknown",
    start_time: record.event.start_time,
    end_time: record.event.end_time
  }));
};
var getUserHostedEvents = async (user_id) => {
  const hostedEvents = await prisma_config_default.events.findMany({
    where: {
      created_by: user_id
    },
    select: {
      id: true,
      title: true,
      start_time: true,
      end_time: true,
      check_out_required: true,
      created_by: true,
      user: {
        select: {
          student: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      start_time: "desc"
    }
  });
  const eventsWithCounts = await Promise.all(
    hostedEvents.map(async (event2) => {
      const checkin_count = await prisma_config_default.attendance.count({
        where: { event_id: event2.id }
      });
      const checkout_count = await prisma_config_default.attendance.count({
        where: {
          event_id: event2.id,
          NOT: {
            check_out_at: null
          }
        }
      });
      return {
        id: event2.id,
        title: event2.title,
        created_by: event2.user.student?.name ?? "Unknown",
        start_time: event2.start_time,
        end_time: event2.end_time,
        attendees: event2.check_out_required ? checkout_count : checkin_count
      };
    })
  );
  return eventsWithCounts;
};
var updateUserProfile = async (user_id, department, program) => {
  const user2 = await prisma_config_default.user.update({
    where: { id: user_id },
    data: {
      student: {
        update: {
          ...department !== void 0 ? { department } : {},
          ...program !== void 0 ? { program } : {}
        }
      }
    },
    include: {
      student: true
    }
  });
  return user2;
};
var userRepository = {
  findUserById,
  onboardUser,
  updateUserProfile,
  getUserAttendedEvents,
  getUserAttendedEventsDetailed,
  getUserHostedEvents
};
var user_repository_default = userRepository;

// src/utils/customErrors.ts
var AppError = class extends Error {
  statusCode;
  isOperational;
  constructor(message, statusCode = 500, name = "AppError") {
    super(message);
    this.name = name;
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
};
var AuthenticationError = class extends AppError {
  constructor(message = "Invalid credentials") {
    super(message, 401, "AuthenticationError");
  }
};
var NotFoundError = class extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NotFoundError");
  }
};
var ForbiddenError = class extends AppError {
  constructor(message = "Access forbidden") {
    super(message, 403, "ForbiddenError");
  }
};
var OrganizerError = class extends AppError {
  constructor(message = "Organizer operation failed") {
    super(message, 400, "OrganizerError");
  }
};
var EmptyTokenError = class extends AppError {
  constructor(message = "Token error") {
    super(message, 401, "TokenError");
  }
};
var GenerateTokenError = class extends AppError {
  constructor(message = "Token generation failed") {
    super(message, 500, "GenerateTokenError");
  }
};
var NoCheckoutRequiredError = class extends AppError {
  constructor(message = "No check-out required for this event") {
    super(message, 400, "NoCheckoutRequiredError");
  }
};
var ConflictError = class extends AppError {
  constructor(message = "Resource conflict") {
    super(message, 409, "ConflictError");
  }
};
var BadRequestError = class extends AppError {
  constructor(message = "Bad request") {
    super(message, 400, "BadRequestError");
  }
};

// src/v1/services/jwt.service.ts
import jwt from "jsonwebtoken";

// src/utils/tokenHashing.ts
import bcrypt from "bcryptjs";
var hashRefreshToken = async (refreshToken) => {
  const saltRound = 10;
  return await bcrypt.hash(refreshToken, saltRound);
};
var verifyHashedRefreshToken = async (refreshToken, hashedRefreshToken) => {
  return await bcrypt.compare(refreshToken, hashedRefreshToken);
};

// src/v1/services/jwt.service.ts
import { v4 as uuidv4 } from "uuid";
import { UAParser } from "ua-parser-js";

// src/constants/jwt.constants.ts
var JWT_ACCESS_TOKEN_SECRET = envHandler_default("JWT_ACCESS_TOKEN_SECRET");
var JWT_ACCESS_TOKEN_TTL = envHandler_default("JWT_REFRESH_TOKEN_TTL");
var JWT_REFRESH_TOKEN_SECRET = envHandler_default("JWT_REFRESH_TOKEN_SECRET");
var JWT_REFRESH_TOKEN_TTL = envHandler_default("JWT_REFRESH_TOKEN_TTL");
var JWT_GOOGLE_STATE_SECRET = envHandler_default("JWT_GOOGLE_STATE_SECRET");

// src/utils/getIPLocation.ts
import axios from "axios";
var getLocationByIp = async (ip) => {
  try {
    const cleanIp = ip.replace("::ffff:", "");
    if (cleanIp === "127.0.0.1" || cleanIp === "::1") {
      return {
        ip: cleanIp,
        city: "Local",
        region: "Local",
        country: "Local"
      };
    }
    const response = await axios.get(`http://ip-api.com/json/${cleanIp}`, {
      timeout: 5e3
    });
    if (response.data.status === "fail") {
      throw new Error(response.data.message);
    }
    return {
      ip: cleanIp,
      city: response.data.city ?? "Unknown",
      region: response.data.regionName ?? "Unknown",
      country: response.data.country ?? "Unknown"
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error("IP location lookup failed:", error.message);
    }
    return {
      ip,
      city: "Unknown",
      region: "Unknown",
      country: "Unknown"
    };
  }
};

// src/v1/services/jwt.service.ts
var generateAccessToken = (tokenPayload) => {
  const {
    user_id,
    umindanao_email,
    role,
    student_id,
    name,
    department,
    program,
    done_onboarding
  } = tokenPayload;
  const requiredFields = [
    {
      user_id,
      umindanao_email,
      role,
      student_id,
      name,
      department,
      program,
      done_onboarding
    }
  ];
  if (requiredFields.some((field) => !field)) {
    throw new GenerateTokenError("Missing required token payload fields");
  }
  return jwt.sign(tokenPayload, JWT_ACCESS_TOKEN_SECRET, {
    expiresIn: `${JWT_ACCESS_TOKEN_TTL}h`
  });
};
var generateRefreshToken = async (user_id, ip, user_agent) => {
  const token_id = uuidv4();
  const expires_at = new Date(
    Date.now() + Number(JWT_ACCESS_TOKEN_TTL) * 60 * 60 * 1e3
  );
  const token = jwt.sign({ token_id, user_id }, JWT_REFRESH_TOKEN_SECRET, {
    expiresIn: `${JWT_REFRESH_TOKEN_TTL}h`
  });
  const hashedToken = await hashRefreshToken(token);
  const parser = new UAParser(user_agent);
  const result = parser.getResult();
  const device = result.device.model ?? result.device.type ?? "Unknown";
  const os = result.os.name ?? "Unknown";
  const browser = result.browser.name ?? "Unknown";
  const { city, region, country } = await getLocationByIp(ip);
  await prisma_config_default.refresh_token.create({
    data: {
      id: token_id,
      user_id,
      token_hash: hashedToken,
      ip_address: ip,
      device,
      os,
      browser,
      city,
      region,
      country,
      expires_at,
      last_used: /* @__PURE__ */ new Date()
    }
  });
  return token;
};

// src/v1/services/user.service.ts
var getUserById = async (user_id) => {
  const user2 = await user_repository_default.findUserById(user_id);
  if (!user2) {
    throw new NotFoundError("User not found");
  }
  return {
    id: user2.id,
    umindanao_email: user2.umindanao_email,
    name: user2.student?.name ?? void 0,
    department: user2.student?.department ?? void 0,
    program: user2.student?.program ?? void 0,
    profile_picture: user2.student?.profile_picture ?? void 0,
    done_onboarding: user2.done_onboarding,
    role: user2.role
  };
};
var onboardUser2 = async (user_id, department, program) => {
  const user2 = await user_repository_default.onboardUser(user_id, department, program);
  if (!user2) {
    throw new NotFoundError("User not found");
  }
  const access_token = generateAccessToken({
    user_id: user2.id,
    umindanao_email: user2.umindanao_email,
    role: user2.role,
    done_onboarding: user2.done_onboarding,
    student_id: Number(user2.student?.student_id),
    name: user2.student?.name,
    department: user2.student?.department ?? "",
    program: user2.student?.program ?? ""
  });
  return {
    access_token,
    user: user2
  };
};
var getUserAttendedEvents2 = async (user_id) => {
  const student = await user_repository_default.findUserById(user_id);
  if (!student || !student.student) {
    return null;
  }
  const events = await user_repository_default.getUserAttendedEvents(
    student.student.student_id
  );
  if (!events) {
    return null;
  }
  return events;
};
var getUserAttendedEventsDetailed2 = async (user_id) => {
  const student = await user_repository_default.findUserById(user_id);
  if (!student || !student.student) {
    throw new NotFoundError("User not found");
  }
  const events = await user_repository_default.getUserAttendedEventsDetailed(
    student.student.student_id
  );
  return events;
};
var getUserHostedEvents2 = async (user_id) => {
  const events = await user_repository_default.getUserHostedEvents(user_id);
  return events;
};
var updateUserProfile2 = async (user_id, department, program) => {
  const user2 = await user_repository_default.updateUserProfile(
    user_id,
    department,
    program
  );
  if (!user2) {
    throw new NotFoundError("User not found");
  }
  return {
    id: user2.id,
    umindanao_email: user2.umindanao_email,
    name: user2.student?.name ?? void 0,
    department: user2.student?.department ?? void 0,
    program: user2.student?.program ?? void 0,
    profile_picture: user2.student?.profile_picture ?? void 0,
    done_onboarding: user2.done_onboarding,
    role: user2.role
  };
};
var userService = {
  getUserById,
  onboardUser: onboardUser2,
  getUserAttendedEvents: getUserAttendedEvents2,
  getUserAttendedEventsDetailed: getUserAttendedEventsDetailed2,
  getUserHostedEvents: getUserHostedEvents2,
  updateUserProfile: updateUserProfile2
};
var user_service_default = userService;

// src/utils/responseHandler.ts
var HTTPSuccessResponse = (res, statusCode, message, data = null) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};
var HTTPErrorResponse = (res, statusCode, error) => {
  return res.status(statusCode).json({
    success: false,
    message: error
  });
};

// src/v1/controllers/user.controller.ts
var getUserById2 = async (req, res) => {
  try {
    const { id } = req.user;
    const user2 = await user_service_default.getUserById(id);
    if (!user2) {
      return HTTPErrorResponse(res, 404, "User not found");
    }
    return HTTPSuccessResponse(res, 200, "User succesfully fetched", {
      user: user2
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var onboardUser3 = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { department, program } = req.body;
    if (!department || !program) {
      return HTTPErrorResponse(res, 400, "Missing Fields");
    }
    const onboarded = await user_service_default.onboardUser(
      user_id,
      department,
      program
    );
    if (!onboarded) {
      return HTTPErrorResponse(res, 404, "User not found");
    }
    res.cookie("access_token", onboarded.access_token, {
      httpOnly: true,
      secure: NODE_ENV === "PRODUCTION",
      sameSite: "strict",
      maxAge: 1 * 60 * 60 * 1e3
    });
    return HTTPSuccessResponse(
      res,
      200,
      "User succesfully updated",
      onboarded
    );
  } catch (error) {
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var getUserAttendedEvents3 = async (req, res) => {
  try {
    const { id } = req.user;
    const events = await user_service_default.getUserAttendedEvents(id);
    if (events === null) {
      return HTTPSuccessResponse(
        res,
        200,
        "User does not attend events yet",
        null
      );
    }
    if (!events) {
      return HTTPErrorResponse(res, 404, "events not found");
    }
    return HTTPSuccessResponse(res, 200, "events succesfully fetched", {
      events
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var getUserAttendedEventsDetailed3 = async (req, res) => {
  try {
    const { id } = req.user;
    const events = await user_service_default.getUserAttendedEventsDetailed(id);
    if (events?.length === 0) {
      return HTTPSuccessResponse(
        res,
        200,
        "User has not attended any events yet",
        []
      );
    }
    return HTTPSuccessResponse(
      res,
      200,
      "Attended events successfully fetched",
      {
        events
      }
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var getUserHostedEvents3 = async (req, res) => {
  try {
    const { id } = req.user;
    const events = await user_service_default.getUserHostedEvents(id);
    if (events?.length === 0) {
      return HTTPSuccessResponse(
        res,
        200,
        "User has not created any events yet",
        []
      );
    }
    return HTTPSuccessResponse(res, 200, "Hosted events successfully fetched", {
      events
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var updateUserProfile3 = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { department, program } = req.body;
    if (department === void 0 && program === void 0) {
      return HTTPErrorResponse(res, 400, "No fields to update");
    }
    const updated = await user_service_default.updateUserProfile(
      user_id,
      department,
      program
    );
    return HTTPSuccessResponse(res, 200, "User profile updated", {
      user: updated
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var userController = {
  getUserById: getUserById2,
  onboardUser: onboardUser3,
  getUserAttendedEvents: getUserAttendedEvents3,
  getUserAttendedEventsDetailed: getUserAttendedEventsDetailed3,
  getUserHostedEvents: getUserHostedEvents3,
  updateUserProfile: updateUserProfile3
};
var user_controller_default = userController;

// src/v1/middlewares/auth.middleware.ts
import jwt2 from "jsonwebtoken";
var authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return HTTPErrorResponse(res, 401, "No token provided");
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt2.verify(token, JWT_ACCESS_TOKEN_SECRET);
    if (!decoded) {
      return HTTPErrorResponse(res, 403, "Invalid token");
    }
    req.user = {
      id: decoded.user_id,
      umindanao_email: decoded.umindanao_email,
      role: decoded.role,
      done_onboarding: decoded.done_onboarding
    };
    return next();
  } catch (error) {
    if (error instanceof Error && error.name === "TokenExpiredError") {
      return HTTPErrorResponse(res, 401, "Access token expired");
    }
    return HTTPErrorResponse(res, 403, "Invalid token");
  }
};

// src/v1/routes/user.routes.ts
var router = express.Router();
router.get("/", authMiddleware, user_controller_default.getUserById);
router.get("/events/:id", user_controller_default.getUserAttendedEvents);
router.get(
  "/attended-events",
  authMiddleware,
  user_controller_default.getUserAttendedEventsDetailed
);
router.get(
  "/hosted-events",
  authMiddleware,
  user_controller_default.getUserHostedEvents
);
router.post("/onboarding", authMiddleware, user_controller_default.onboardUser);
router.put("/", authMiddleware, user_controller_default.updateUserProfile);
var user_routes_default = router;

// src/v1/routes/auth.routes.ts
import express2 from "express";

// src/v1/services/google.service.ts
import axios2 from "axios";
import jwt3 from "jsonwebtoken";
import crypto from "crypto";
import { URLSearchParams } from "url";

// src/constants/google.constants.ts
import { OAuth2Client } from "google-auth-library";
var GOOGLE_CLIENT_ID = envHandler_default("GOOGLE_CLIENT_ID");
var GOOGLE_CLIENT_SECRET = envHandler_default("GOOGLE_CLIENT_SECRET");
var GOOGLE_REDIRECT_URI = envHandler_default("GOOGLE_REDIRECT_URI");
var GOOGLE_CLIENT = new OAuth2Client(GOOGLE_CLIENT_ID);

// src/v1/services/google.service.ts
var generatePKCE = () => {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
};
var generateGoogleAuthUrl = () => {
  const nonce = crypto.randomBytes(16).toString("hex");
  const { codeVerifier, codeChallenge } = generatePKCE();
  const statePayload = {
    nonce,
    timestamp: Date.now(),
    exp: Math.floor(Date.now() / 1e3) + 5 * 60,
    codeVerifier
  };
  if (!JWT_GOOGLE_STATE_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }
  const state = jwt3.sign(statePayload, JWT_GOOGLE_STATE_SECRET);
  const url = `https://accounts.google.com/o/oauth2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_REDIRECT_URI}&scope=email%20profile&response_type=code&access_type=offline&prompt=consent&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256&hd=umindanao.edu.ph`;
  return url;
};
var exchangeCodeForUserInfo = async (code, state) => {
  try {
    if (!JWT_GOOGLE_STATE_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }
    const decoded = jwt3.verify(state, JWT_GOOGLE_STATE_SECRET);
    const codeVerifier = decoded.codeVerifier;
    if (!codeVerifier) {
      throw new Error("Invalid state - missing code verifier");
    }
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
      throw new Error("Missing required environment variables");
    }
    const tokenRes = await axios2.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
        code_verifier: codeVerifier
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );
    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      throw new Error("No access token received from Google");
    }
    const userRes = await axios2.get(
      "https://www.googleapis.com/oauth2/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    return {
      google_id: userRes.data.id,
      email: userRes.data.email,
      name: userRes.data.name,
      profile_picture: userRes.data.picture
    };
  } catch (error) {
    console.log(error);
    throw new Error("Failed to exchange code for user info");
  }
};
var verifyGoogleToken = async (token) => {
  try {
    const ticket = await GOOGLE_CLIENT.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error("Invalid token payload");
    }
    if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
      throw new Error("Invalid token issuer");
    }
    if (payload.exp < Date.now() / 1e3) {
      throw new Error("Token expired");
    }
    if (payload.aud !== GOOGLE_CLIENT_ID) {
      throw new Error("Invalid audience");
    }
    return {
      google_id: payload.sub,
      email: payload.email,
      name: payload.name,
      profile_picture: payload.picture
    };
  } catch (error) {
    throw new Error("Invalid Google token");
  }
};
var validateState = (state) => {
  try {
    if (!JWT_GOOGLE_STATE_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }
    const decoded = jwt3.verify(state, JWT_GOOGLE_STATE_SECRET);
    if (!decoded.timestamp || !decoded.exp) {
      return false;
    }
    const now = Math.floor(Date.now() / 1e3);
    if (decoded.exp < now) {
      return false;
    }
    const timeDiff = Date.now() - decoded.timestamp;
    if (timeDiff > 5 * 60 * 1e3) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
};
var validateRedirectUri = (GOOGLE_REDIRECT_URI2) => {
  if (!GOOGLE_REDIRECT_URI2) {
    throw new Error(
      "GOOGLE_REDIRECT_URI is not defined in environment variables"
    );
  }
  return GOOGLE_REDIRECT_URI2 === GOOGLE_REDIRECT_URI2;
};
var GoogleAuth = {
  generateGoogleAuthUrl,
  exchangeCodeForUserInfo,
  verifyGoogleToken,
  validateState,
  validateRedirectUri
};
var google_service_default = GoogleAuth;

// src/configs/redis.config.ts
import Redis from "ioredis";

// src/constants/redis.constants.ts
var REDIS_HOST = envHandler_default("REDIS_HOST");
var REDIS_PORT = parseInt(envHandler_default("REDIS_PORT"));
var REDIS_USERNAME = envHandler_default("REDIS_USERNAME");
var REDIS_PASSWORD = envHandler_default("REDIS_PASSWORD");

// src/configs/redis.config.ts
var redis = new Redis({
  host: REDIS_HOST,
  username: REDIS_USERNAME,
  port: Number(REDIS_PORT),
  password: REDIS_PASSWORD
});
var redis_config_default = redis;

// src/v1/repositories/auth.repository.ts
var findUserByGoogleId = async (google_id) => {
  return await prisma_config_default.user.findUnique({
    where: { google_id },
    include: {
      student: {
        select: {
          student_id: true,
          name: true,
          department: true,
          program: true,
          profile_picture: true
        }
      }
    }
  });
};
var createUser = async (user_data) => {
  return await prisma_config_default.user.create({
    data: {
      umindanao_email: user_data.umindanao_email,
      google_id: user_data.google_id,
      role: user_data.role,
      last_login_at: /* @__PURE__ */ new Date(),
      student: {
        create: {
          name: user_data.name,
          student_id: user_data.student_id,
          profile_picture: user_data.profile_picture
        }
      }
    },
    include: {
      student: true
    }
  });
};
var updateLoginAndProfile = async (user_id, profile_picture) => {
  return prisma_config_default.$transaction(async (tx) => {
    await Promise.all([
      tx.user.update({
        where: { id: user_id },
        data: { last_login_at: /* @__PURE__ */ new Date() }
      }),
      tx.student.updateMany({
        where: { user_id },
        data: { profile_picture }
      })
    ]);
  });
};
var findUserByEmail = async (umindanao_email) => {
  return await prisma_config_default.user.findUnique({
    where: { umindanao_email }
  });
};
var getUserById3 = async (user_id) => {
  return await prisma_config_default.user.findUnique({
    where: { id: user_id },
    include: { student: true }
  });
};
var updateUser = async (user_id, updated_data) => {
  return await prisma_config_default.user.update({
    where: { id: user_id },
    data: updated_data,
    include: { student: true }
  });
};
var verifyRefreshToken = async (tokenID) => {
  return await prisma_config_default.refresh_token.findUnique({
    where: { id: tokenID }
  });
};
var findRefreshToken = async (token_id) => {
  return await prisma_config_default.refresh_token.findFirst({
    where: { id: token_id, is_active: true },
    include: { user: { include: { student: true } } }
  });
};
var revokeRefreshToken = async (token_id) => {
  return prisma_config_default.$transaction(async (tx) => {
    const token = await tx.refresh_token.findUnique({
      where: { id: token_id }
    });
    if (!token?.is_active) {
      return null;
    }
    return tx.refresh_token.update({
      where: { id: token_id },
      data: { is_active: false, revoked_at: /* @__PURE__ */ new Date() }
    });
  });
};
var createErrorCode = async (error_code, error_message) => {
  return await redis_config_default.setex(
    `error_code:${error_code}`,
    60,
    JSON.stringify({
      error_message
    })
  );
};
var getErrorCode = async (error_code) => {
  return await redis_config_default.getdel(`error_code:${error_code}`);
};
var createAuthCode = async (auth_code, access_token, refresh_token) => {
  return await redis_config_default.setex(
    `auth_code:${auth_code}`,
    60,
    JSON.stringify({
      access_token,
      refresh_token
    })
  );
};
var getAuthCode = async (auth_code) => {
  return await redis_config_default.getdel(`auth_code:${auth_code}`);
};
var getLoginHistory = async (user_id) => {
  return await prisma_config_default.refresh_token.findMany({
    where: { user_id },
    select: {
      id: true,
      browser: true,
      os: true,
      city: true,
      region: true,
      country: true
    },
    orderBy: { created_at: "desc" },
    take: 10
  });
};
var getEventOragazerByUserId = async (user_id, event_id) => {
  return await prisma_config_default.organizers.findFirst({
    where: { user_id, event_id }
  });
};
var authRepository = {
  createUser,
  updateUser,
  getUserById: getUserById3,
  findUserByEmail,
  findUserByGoogleId,
  updateLoginAndProfile,
  findRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  createErrorCode,
  getErrorCode,
  createAuthCode,
  getAuthCode,
  getLoginHistory,
  getEventOragazerByUserId
};
var auth_repository_default = authRepository;

// src/v1/services/auth.service.ts
import jwt4 from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import crypto2 from "crypto";

// src/utils/string.utils.ts
var sanitizeKey = (key) => key.replace(/[^a-zA-Z0-9:_-]/g, "");
var extractStudentID = (email) => {
  const match = email.match(/\.([0-9]+)@umindanao\.edu\.ph$/);
  return match ? match[1] : null;
};

// src/v1/services/auth.service.ts
var googleAuthWithCode = async (code, state, ip_address, userAgent) => {
  const googleUser = await google_service_default.exchangeCodeForUserInfo(code, state);
  let user2 = await auth_repository_default.findUserByGoogleId(googleUser.google_id);
  if (!user2) {
    const student_id = Number(extractStudentID(googleUser.email));
    try {
      user2 = await auth_repository_default.createUser({
        umindanao_email: googleUser.email,
        google_id: googleUser.google_id,
        role: "student",
        student_id,
        name: googleUser.name,
        profile_picture: googleUser.profile_picture
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        user2 = await auth_repository_default.findUserByGoogleId(googleUser.google_id);
        if (!user2) {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }
  await auth_repository_default.updateLoginAndProfile(
    user2.id,
    googleUser.profile_picture
  );
  const access_token = generateAccessToken({
    user_id: user2.id,
    umindanao_email: user2.umindanao_email,
    role: user2.role,
    done_onboarding: user2.done_onboarding,
    student_id: Number(user2.student?.student_id),
    name: user2.student?.name,
    department: user2.student?.department ?? "",
    program: user2.student?.program ?? "",
    profile_picture: user2.student?.profile_picture ?? ""
  });
  const refresh_token = await generateRefreshToken(
    user2.id,
    ip_address,
    userAgent
  );
  return { access_token, refresh_token, user: user2 };
};
var refreshAccessToken = async (refresh_token) => {
  let token;
  let expiredAt;
  try {
    token = jwt4.verify(
      refresh_token,
      JWT_REFRESH_TOKEN_SECRET
    );
  } catch (error) {
    if (error instanceof jwt4.TokenExpiredError) {
      expiredAt = error.expiredAt;
      throw new jwt4.TokenExpiredError("Refresh token has expired", expiredAt);
    }
    throw new AuthenticationError("Invalid refresh token format");
  }
  const verifyTokenDBExist = await auth_repository_default.verifyRefreshToken(
    token.token_id
  );
  if (!verifyTokenDBExist) {
    throw new NotFoundError("Refresh token not found");
  }
  if (!verifyTokenDBExist.is_active) {
    throw new AuthenticationError("Refresh token has been revoked");
  }
  if (new Date(verifyTokenDBExist.expires_at) < /* @__PURE__ */ new Date()) {
    throw new jwt4.TokenExpiredError(
      "Refresh token has expired",
      verifyTokenDBExist.expires_at
    );
  }
  const validateHashedToken = await verifyHashedRefreshToken(
    refresh_token,
    verifyTokenDBExist.token_hash
  );
  if (!validateHashedToken) {
    throw new AuthenticationError("Invalid refresh token");
  }
  const user2 = await auth_repository_default.getUserById(token.user_id);
  if (!user2) {
    throw new NotFoundError("User not found");
  }
  return generateAccessToken({
    user_id: user2.id,
    umindanao_email: user2.id,
    role: user2.id,
    student_id: user2.student?.student_id,
    name: user2.student?.name,
    department: user2.student?.department,
    program: user2.student?.program
  });
};
var logoutUser = async (refresh_token) => {
  if (!refresh_token) {
    throw new EmptyTokenError("Refresh token is required");
  }
  let verifyToken;
  try {
    verifyToken = jwt4.verify(
      refresh_token,
      JWT_REFRESH_TOKEN_SECRET
    );
  } catch (error) {
    if (error instanceof jwt4.TokenExpiredError) {
      throw new jwt4.TokenExpiredError("Refresh token has expired", error.expiredAt);
    }
    throw new AuthenticationError("Invalid refresh token format");
  }
  const tokenRecord = await auth_repository_default.verifyRefreshToken(verifyToken.token_id);
  if (!tokenRecord) {
    throw new NotFoundError("Refresh token not found");
  }
  const validateHashedToken = await verifyHashedRefreshToken(
    refresh_token,
    tokenRecord.token_hash
  );
  if (!validateHashedToken) {
    throw new AuthenticationError("Invalid refresh token");
  }
  const revoked = await auth_repository_default.revokeRefreshToken(verifyToken.token_id);
  if (!revoked) {
    throw new AuthenticationError("Refresh token has already been revoked");
  }
};
var generateErrorCode = async (error_message) => {
  const error_code = crypto2.randomBytes(32).toString("hex");
  await auth_repository_default.createErrorCode(error_code, error_message);
  return error_code;
};
var generateAuthCode = async (access_token, refresh_token) => {
  const auth_code = crypto2.randomBytes(32).toString("hex");
  await auth_repository_default.createAuthCode(auth_code, access_token, refresh_token);
  return auth_code;
};
var getDataFromErrorCode = async (error_code) => {
  const sanitizedErrorCode = sanitizeKey(error_code);
  const error = await auth_repository_default.getErrorCode(sanitizedErrorCode);
  if (!error) {
    throw new NotFoundError("Error code not found");
  }
  const { error_message } = JSON.parse(error);
  return error_message;
};
var getDataFromAuthCode = async (auth_code) => {
  const sanitizedAuthCode = sanitizeKey(auth_code);
  const tokens = await auth_repository_default.getAuthCode(sanitizedAuthCode);
  if (!tokens) {
    throw new NotFoundError("Auth code not found");
  }
  const { access_token, refresh_token } = JSON.parse(tokens);
  return { access_token, refresh_token };
};
var getLoginHistory2 = async (user_id) => {
  return await auth_repository_default.getLoginHistory(user_id);
};
var authServices = {
  googleAuthWithCode,
  refreshAccessToken,
  logoutUser,
  generateErrorCode,
  getDataFromErrorCode,
  generateAuthCode,
  getDataFromAuthCode,
  getLoginHistory: getLoginHistory2
};
var auth_service_default = authServices;

// src/v1/controllers/auth.controller.ts
import jwt5 from "jsonwebtoken";
var googleAuth = async (req, res) => {
  try {
    const url = google_service_default.generateGoogleAuthUrl();
    return res.redirect(url);
  } catch (error) {
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(
        res,
        500,
        `Internal server error:${error}`
      );
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var googleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const currentUri = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`;
    const frontendUrl = FRONTEND_URL;
    if (!code) {
      const error_code = await auth_service_default.generateErrorCode(
        "Missing authorization code"
      );
      return res.redirect(`${frontendUrl}/?error_code=${error_code}`);
    }
    if (!google_service_default.validateRedirectUri(currentUri)) {
      const error_code = await auth_service_default.generateErrorCode(
        "Invalid redirect URI"
      );
      return res.redirect(`${frontendUrl}/?error_code=${error_code}`);
    }
    if (!google_service_default.validateState(state)) {
      const error_code = await auth_service_default.generateErrorCode(
        "Invalid state parameter"
      );
      return res.redirect(`${frontendUrl}/?error_code=${error_code}`);
    }
    const result = await auth_service_default.googleAuthWithCode(
      code,
      state,
      req.ip,
      req.headers["user-agent"] ?? ""
    );
    const auth_code = await auth_service_default.generateAuthCode(
      result.access_token,
      result.refresh_token
    );
    res.cookie("access_token", result.access_token, {
      httpOnly: true,
      secure: NODE_ENV === "PRODUCTION",
      sameSite: "strict",
      maxAge: Number(JWT_ACCESS_TOKEN_TTL) * 60 * 60 * 1e3
    });
    res.cookie("refresh_token", result.refresh_token, {
      httpOnly: true,
      secure: NODE_ENV === "PRODUCTION",
      sameSite: "strict",
      maxAge: Number(JWT_REFRESH_TOKEN_TTL) * 60 * 60 * 1e3
    });
    return res.redirect(`${frontendUrl}/?auth_code=${auth_code}`);
  } catch (error) {
    const frontendUrl = FRONTEND_URL ?? "http://localhost:3000";
    const error_code = await auth_service_default.generateErrorCode(
      "Internal server error"
    );
    if (error instanceof jwt5.TokenExpiredError) {
      const error_code2 = await auth_service_default.generateErrorCode(
        "Internal server error"
      );
      return res.redirect(`${frontendUrl}/?error_code=${error_code2}`);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(
        res,
        500,
        `Internal server error:${error}`
      );
    }
    return res.redirect(`${frontendUrl}/?error_code=${error_code}`);
  }
};
var logoutUser2 = async (req, res) => {
  try {
    const refresh_token = req.body?.refresh_token;
    const cookieRefreshToken = req.cookies?.refresh_token;
    const finalRefreshToken = refresh_token ?? cookieRefreshToken;
    if (finalRefreshToken) {
      await auth_service_default.logoutUser(finalRefreshToken);
    }
    if (req.cookies["refresh_token"]) {
      res.clearCookie("refresh_token");
    }
    if (req.cookies["access_token"]) {
      res.clearCookie("access_token");
    }
    return HTTPSuccessResponse(res, 200, "Logged out successfully");
  } catch (error) {
    console.log(error);
    if (NODE_ENV === "DEVELOPMENT") {
      if (error instanceof jwt5.JsonWebTokenError) {
        return HTTPErrorResponse(res, 400, error.message);
      }
    }
    if (error instanceof jwt5.TokenExpiredError) {
      return HTTPErrorResponse(res, 401, "Token Expire");
    }
    if (error instanceof AuthenticationError) {
      return HTTPErrorResponse(res, 401, "Authentication Error");
    }
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, "Not Found");
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(
        res,
        500,
        `Internal server error:${error}`
      );
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var refreshAccessToken2 = async (req, res) => {
  try {
    const refresh_token = req.cookies.refresh_token ?? req.body.refresh_token;
    if (!refresh_token) {
      return HTTPErrorResponse(
        res,
        400,
        "Refresh token is required"
      );
    }
    const accessToken = await auth_service_default.refreshAccessToken(refresh_token);
    return HTTPSuccessResponse(
      res,
      200,
      "Access Token Refreshed Successfully",
      {
        access_token: accessToken
      }
    );
  } catch (error) {
    if (NODE_ENV === "DEVELOPMENT") {
      if (error instanceof jwt5.JsonWebTokenError) {
        return HTTPErrorResponse(res, 400, error.message);
      }
    }
    console.log(error);
    if (error instanceof jwt5.TokenExpiredError) {
      return HTTPErrorResponse(res, 401, "Token Expire");
    }
    if (error instanceof AuthenticationError) {
      return HTTPErrorResponse(res, 401, "Authentication Error");
    }
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, "Not Found");
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(
        res,
        500,
        `Internal server error:${error}`
      );
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var exhangeCode = async (req, res) => {
  try {
    if (!req.body) {
      return HTTPErrorResponse(res, 400, "Missing request body");
    }
    const { auth_code, error_code } = req.body;
    if (!auth_code && !error_code) {
      return HTTPErrorResponse(res, 400, "Missing exchange code");
    }
    let response = {};
    let response_message = "";
    if (auth_code) {
      const tokens = await auth_service_default.getDataFromAuthCode(auth_code);
      const { access_token, refresh_token } = tokens;
      response = { access_token, refresh_token };
      response_message = "Tokens retrieved";
    }
    if (error_code) {
      const error_message = await auth_service_default.getDataFromErrorCode(error_code);
      response_message = "Error during authentication";
      response = { error_message };
      if (error_message) {
        return HTTPErrorResponse(res, 400, error_message);
      }
    }
    return HTTPSuccessResponse(
      res,
      200,
      response_message,
      response
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(
        res,
        500,
        `Internal server error:${error}`
      );
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var getLoginHistory3 = async (req, res) => {
  try {
    const user_id = req.user.id;
    const login_history = await auth_service_default.getLoginHistory(user_id);
    return HTTPSuccessResponse(res, 200, "Login history retrieved", {
      login_history
    });
  } catch (error) {
    console.log(error);
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(
        res,
        500,
        `Internal server error:${error}`
      );
    }
    if (NODE_ENV === "DEVELOPMENT") {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var authController = {
  googleAuth,
  googleCallback,
  logoutUser: logoutUser2,
  refreshAccessToken: refreshAccessToken2,
  exhangeCode,
  getLoginHistory: getLoginHistory3
};
var auth_controller_default = authController;

// src/v1/routes/auth.routes.ts
var router2 = express2.Router();
router2.get("/google", auth_controller_default.googleAuth);
router2.get("/google/callback", auth_controller_default.googleCallback);
router2.post("/refresh", authMiddleware, auth_controller_default.refreshAccessToken);
router2.post("/logout", authMiddleware, auth_controller_default.logoutUser);
router2.post("/exchange", auth_controller_default.exhangeCode);
router2.get("/login-history", authMiddleware, auth_controller_default.getLoginHistory);
var auth_routes_default = router2;

// src/v1/routes/event.routes.ts
import express3 from "express";

// src/v1/controllers/event.controller.ts
import ExcelJS from "exceljs";
import { matchedData, validationResult } from "express-validator";

// src/v1/repositories/event.repository.ts
var createEvent = async (event_data) => {
  return await prisma_config_default.$transaction(async (tx) => {
    const event2 = await tx.events.create({
      data: {
        ...event_data
      }
    });
    await tx.organizers.create({
      data: {
        user_id: event2.created_by,
        event_id: event2.id,
        added_by: event2.created_by
      }
    });
    return event2;
  });
};
var deleteEvent = async (eventId) => {
  return prisma_config_default.$transaction(async (tx) => {
    const existing = await tx.events.findUnique({
      where: { id: eventId }
    });
    if (!existing) {
      throw new Error("Event not found or already deleted.");
    }
    if (existing.is_done) {
      throw new Error("Cannot delete a completed event.");
    }
    const checkinCount = await tx.attendance.count({
      where: { event_id: eventId }
    });
    if (checkinCount > 0) {
      throw new ForbiddenError(
        "Cannot delete event with existing check-ins. Please contact support."
      );
    }
    if (existing.check_out_required) {
      const checkoutCount = await tx.attendance.count({
        where: { event_id: eventId, NOT: { check_out_at: null } }
      });
      if (checkoutCount > 0) {
        throw new ForbiddenError(
          "Cannot delete event with existing check-outs. Please contact support."
        );
      }
    }
    return tx.events.delete({
      where: { id: eventId }
    });
  });
};
var updateEvent = async (eventId, event_data) => {
  return await prisma_config_default.events.update({
    where: { id: eventId },
    data: {
      ...event_data
    }
  });
};
var getEventDetails = async (eventId) => {
  return await prisma_config_default.events.findUnique({
    where: { id: eventId }
  });
};
var getAllEvents = async () => {
  const events = await prisma_config_default.events.findMany({
    orderBy: { start_time: "asc" },
    where: {
      is_done: false
    }
  });
  return await Promise.all(
    events.map(async (event2) => {
      const checkin_count = await prisma_config_default.attendance.count({
        where: { event_id: event2.id }
      });
      const checkout_count = await prisma_config_default.attendance.count({
        where: {
          event_id: event2.id,
          NOT: {
            check_out_at: null
          }
        }
      });
      return {
        ...event2,
        checkin_count,
        checkout_count
      };
    })
  );
};
var getAllPastEvents = async () => {
  const events = await prisma_config_default.events.findMany({
    orderBy: { end_time: "desc" },
    where: {
      is_done: true
    }
  });
  return await Promise.all(
    events.map(async (event2) => {
      const checkin_count = await prisma_config_default.attendance.count({
        where: { event_id: event2.id }
      });
      const checkout_count = await prisma_config_default.attendance.count({
        where: {
          event_id: event2.id,
          NOT: {
            check_out_at: null
          }
        }
      });
      return {
        ...event2,
        checkin_count,
        checkout_count
      };
    })
  );
};
var createCheckInEvent = async (attendance_data) => {
  const { event_id, student_id, check_in_at, check_in_by } = attendance_data;
  return await prisma_config_default.$transaction(async (tx) => {
    const event2 = await tx.events.findUnique({
      where: { id: event_id }
    });
    if (!event2) {
      throw new NotFoundError("Event not found");
    }
    if (event2.is_done) {
      throw new Error("Event has already ended");
    }
    if (event2.capacity !== null && event2.capacity !== void 0) {
      const currentCount = await tx.attendance.count({
        where: { event_id }
      });
      if (currentCount >= event2.capacity) {
        throw new Error("Event has reached its maximum capacity");
      }
    }
    const student = await tx.student.findUnique({
      where: { student_id }
    });
    if (!student) {
      throw new NotFoundError("Student not found");
    }
    const existingCheckIn = await tx.attendance.findFirst({
      where: {
        event_id,
        student_id
      }
    });
    if (existingCheckIn) {
      throw new ConflictError("Student is already checked in to this event");
    }
    return await tx.attendance.create({
      data: {
        event_id,
        student_id,
        check_in_by,
        check_in_at: check_in_at ?? (/* @__PURE__ */ new Date()).toISOString()
      },
      include: {
        event: true,
        student: true,
        check_in_by_user: true
      }
    });
  });
};
var createCheckOutEvent = async (attendance_data) => {
  const { event_id, student_id, check_out_at, check_out_by } = attendance_data;
  return await prisma_config_default.$transaction(async (tx) => {
    const event2 = await tx.events.findUnique({
      where: { id: event_id }
    });
    if (!event2) {
      throw new NotFoundError("Event not found");
    }
    if (event2.is_done) {
      throw new Error("Event has already ended");
    }
    const student = await tx.student.findUnique({
      where: { student_id }
    });
    if (!student) {
      throw new NotFoundError("Student not found");
    }
    const existingCheckIn = await tx.attendance.findFirst({
      where: {
        event_id,
        student_id
      }
    });
    if (!existingCheckIn) {
      throw new BadRequestError("Student has not checked in to this event");
    }
    if (existingCheckIn.check_out_at) {
      throw new ConflictError("Student has already checked out of this event");
    }
    return await tx.attendance.update({
      where: {
        id: existingCheckIn.id
      },
      data: {
        check_out_at: check_out_at ?? /* @__PURE__ */ new Date(),
        check_out_by
      },
      include: {
        event: true,
        student: true,
        check_in_by_user: true,
        check_out_by_user: true
      }
    });
  });
};
var checkOrganizer = async (user_id, event_id) => {
  return await prisma_config_default.organizers.findUnique({
    where: {
      user_id_event_id: {
        user_id,
        event_id
      }
    }
  });
};
var addOrganizer = async (user_id, added_by, event_id) => {
  return await prisma_config_default.organizers.create({
    data: {
      user_id,
      event_id,
      added_by
    }
  });
};
var removeOrganizer = async (user_id, event_id) => {
  return await prisma_config_default.organizers.delete({
    where: {
      user_id_event_id: {
        user_id,
        event_id
      }
    }
  });
};
var getOrganizersByEventId = async (event_id) => {
  const organizers = await prisma_config_default.organizers.findMany({
    where: {
      event_id
    },
    include: {
      user: {
        select: {
          umindanao_email: true,
          student: {
            select: {
              student_id: true,
              name: true,
              department: true,
              program: true
            }
          }
        }
      },
      addedBy: {
        select: {
          student: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      created_at: "asc"
    }
  });
  return organizers.map((organizer) => ({
    student_id: organizer.user.student?.student_id ?? null,
    name: organizer.user.student?.name ?? "N/A",
    department: organizer.user.student?.department ?? "N/A",
    program: organizer.user.student?.program ?? "N/A",
    umindanao_email: organizer.user.umindanao_email,
    added_by: organizer.addedBy?.student?.name ?? "System",
    added_at: organizer.created_at
  }));
};
var getPaginatedAttendeesByEventId = async (event_id, page, limit, search) => {
  const skip = (page - 1) * limit;
  const whereClause = {
    event_id
  };
  if (search) {
    const orConditions = [];
    orConditions.push({
      student: {
        name: {
          contains: search,
          mode: "insensitive"
        }
      }
    });
    const parsedId = Number(search);
    if (!Number.isNaN(parsedId) && Number.isFinite(parsedId)) {
      orConditions.push({
        student: {
          student_id: {
            equals: parsedId
          }
        }
      });
    }
    orConditions.push({
      student: {
        user: {
          umindanao_email: {
            contains: search,
            mode: "insensitive"
          }
        }
      }
    });
    whereClause.OR = orConditions;
  }
  const [attendees, total] = await Promise.all([
    prisma_config_default.attendance.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            user_id: true,
            student_id: true,
            name: true,
            department: true,
            program: true,
            profile_picture: true,
            created_at: true,
            updated_at: true,
            user: {
              // ✅ now nested under student
              select: { umindanao_email: true }
            }
          }
        },
        check_in_by_user: {
          select: { id: true }
        },
        check_out_by_user: {
          select: { id: true }
        }
      },
      orderBy: {
        check_in_at: "desc"
      },
      skip,
      take: limit
    }),
    prisma_config_default.attendance.count({ where: whereClause })
  ]);
  return { attendees, total };
};
var massCheckOutStudents = async (event_id, student_ids, check_out_by, check_out_at) => {
  return await prisma_config_default.$transaction(async (tx) => {
    const existing = await tx.attendance.findMany({
      where: {
        event_id,
        student_id: { in: student_ids }
      }
    });
    const existingMap = /* @__PURE__ */ new Map();
    existing.forEach((e) => existingMap.set(e.student_id, e));
    const notCheckedIn = [];
    const alreadyCheckedOut = [];
    const toUpdateIds = [];
    for (const sid of student_ids) {
      const rec = existingMap.get(sid);
      if (!rec) {
        notCheckedIn.push(sid);
        console.log(
          `massCheckOut: student ${sid} not checked in for event ${event_id}, skipping`
        );
        continue;
      }
      if (rec.check_out_at) {
        alreadyCheckedOut.push(sid);
        console.log(
          `massCheckOut: student ${sid} already checked out for event ${event_id}, skipping`
        );
        continue;
      }
      toUpdateIds.push(rec.id);
    }
    if (toUpdateIds.length > 0) {
      await tx.attendance.updateMany({
        where: { id: { in: toUpdateIds } },
        data: {
          check_out_at: check_out_at ?? /* @__PURE__ */ new Date(),
          check_out_by
        }
      });
    }
    const updatedRecords = await tx.attendance.findMany({
      where: {
        id: { in: toUpdateIds }
      },
      include: {
        event: true,
        student: true,
        check_in_by_user: true,
        check_out_by_user: true
      }
    });
    return {
      updatedRecords,
      alreadyCheckedOut,
      notCheckedIn,
      updatedCount: updatedRecords.length
    };
  });
};
var getAttendeesByEventId = async (event_id) => {
  return await prisma_config_default.attendance.findMany({
    where: { event_id },
    include: {
      student: {
        select: {
          id: true,
          user_id: true,
          student_id: true,
          name: true,
          department: true,
          program: true,
          profile_picture: true,
          created_at: true,
          updated_at: true,
          user: {
            select: { umindanao_email: true }
          }
        }
      },
      check_in_by_user: { select: { id: true } },
      check_out_by_user: { select: { id: true } }
    },
    orderBy: { check_in_at: "desc" }
  });
};
var getEventAttendanceCount = async (event_id) => {
  const event2 = await prisma_config_default.events.findUnique({
    where: { id: event_id }
  });
  if (!event2) {
    throw new NotFoundError("Event not found");
  }
  const totalAttendance = await prisma_config_default.attendance.count({
    where: { event_id }
  });
  const totalCheckedOut = await prisma_config_default.attendance.count({
    where: {
      event_id,
      NOT: {
        check_out_at: null
      }
    }
  });
  return { totalAttendance, totalCheckedOut };
};
var getEventCheckoutCount = async (event_id) => {
  return await prisma_config_default.attendance.count({
    where: {
      event_id,
      NOT: {
        check_out_at: null
      }
    }
  });
};
var getEventCheckinCount = async (event_id) => {
  return await prisma_config_default.attendance.count({
    where: { event_id }
  });
};
var checkIfUserAttended = async (event_id, student_id) => {
  const [event2, attendance] = await Promise.all([
    prisma_config_default.events.findUnique({
      where: { id: event_id },
      select: { check_out_required: true }
    }),
    prisma_config_default.attendance.findFirst({
      where: {
        event_id,
        student_id
      },
      select: {
        id: true,
        check_in_at: true,
        check_out_at: true
      }
    })
  ]);
  if (!attendance) {
    return null;
  }
  return {
    id: attendance.id,
    check_in_at: attendance.check_in_at,
    check_out_at: event2?.check_out_required ? attendance.check_out_at : false
  };
};
var eventRepository = {
  createEvent,
  deleteEvent,
  updateEvent,
  getEventDetails,
  createCheckInEvent,
  createCheckOutEvent,
  addOrganizer,
  removeOrganizer,
  getOrganizersByEventId,
  checkOrganizer,
  getAllEvents,
  getAllPastEvents,
  getAttendeesByEventId,
  getEventCheckoutCount,
  getEventCheckinCount,
  getPaginatedAttendeesByEventId,
  checkIfUserAttended,
  getEventAttendanceCount,
  massCheckOutStudents
};
var event_repository_default = eventRepository;

// src/v1/services/event.service.ts
import { Prisma as Prisma2 } from "@prisma/client";

// src/v1/queues/endEvent.queue.ts
import { Queue, Worker } from "bullmq";
var connection = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};
var endEventStatusQueue = new Queue("event-end-status-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5e3 },
    removeOnFail: false
  }
});
var endEventStatusWorker = new Worker(
  "event-end-status-queue",
  async (job) => {
    const { event_id } = job.data;
    console.log(`Checking event ${event_id} status`);
    await prisma_config_default.events.update({
      where: { id: event_id },
      data: { is_done: true }
    });
    console.log(`Event ${event_id} marked as done.`);
  },
  { connection, concurrency: 1 }
);
endEventStatusWorker.on("completed", (job) => {
  console.log(`Job completed for event ${job.data.event_id}`);
});
endEventStatusWorker.on("failed", (job, err) => {
  console.error(`Job failed for event ${job?.data?.event_id}:`, err);
});

// src/v1/queues/startEvent.queue.ts
import { Queue as Queue2, Worker as Worker2 } from "bullmq";
var connection2 = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};
var startEventStatusQueue = new Queue2("event-start-status-queue", {
  connection: connection2
});
var startEventStatusWorker = new Worker2(
  "event-start-status-queue",
  async (job) => {
    const { event_id } = job.data;
    console.log(`Checking event ${event_id} start status`);
    await prisma_config_default.events.update({
      where: { id: event_id },
      data: { is_started: true }
    });
    console.log(`Event ${event_id} marked as started.`);
  },
  { connection: connection2, concurrency: 1 }
);
startEventStatusWorker.on("completed", (job) => {
  console.log(`Start job completed for event ${job.data.event_id}`);
});
startEventStatusWorker.on("failed", (job, err) => {
  console.error(`Start job failed for event ${job?.data?.event_id}:`, err);
});

// src/v1/repositories/student.repository.ts
var getStudentByUserId = async (user_id) => {
  return await prisma_config_default.student.findUnique({
    where: { user_id }
  });
};
var getUserByStudentId = async (student_id) => {
  return await prisma_config_default.user.findFirst({
    where: { student: { student_id } },
    select: {
      id: true,
      umindanao_email: true,
      student: true
    }
  });
};
var studentRepository = { getStudentByUserId, getUserByStudentId };
var student_repository_default = studentRepository;

// src/v1/template/checkIn.email.ts
var CHECK_IN_EMAIL = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
 <head>
  <meta charset="UTF-8">
  <meta content="width=device-width, initial-scale=1" name="viewport">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta content="telephone=no" name="format-detection">
  <title>UMAttend Check In Email</title><!--[if (mso 16)]>
    <style type="text/css">
    a {text-decoration: none;}
    </style>
    <![endif]--><!--[if gte mso 9]><style>sup { font-size: 100% !important; }</style><![endif]--><!--[if gte mso 9]>
<noscript>
         <xml>
           <o:OfficeDocumentSettings>
           <o:AllowPNG></o:AllowPNG>
           <o:PixelsPerInch>96</o:PixelsPerInch>
           </o:OfficeDocumentSettings>
         </xml>
      </noscript>
<![endif]--><!--[if mso]><xml>
    <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
      <w:DontUseAdvancedTypographyReadingMail/>
    </w:WordDocument>
    </xml><![endif]-->
  <style type="text/css">.rollover:hover .rollover-first {
  max-height:0px!important;
  display:none!important;
}
.rollover:hover .rollover-second {
  max-height:none!important;
  display:block!important;
}
.rollover span {
  font-size:0px;
}
u + .body img ~ div div {
  display:none;
}
#outlook a {
  padding:0;
}
span.MsoHyperlink,
span.MsoHyperlinkFollowed {
  color:inherit;
  mso-style-priority:99;
}
a.t {
  mso-style-priority:100!important;
  text-decoration:none!important;
}
a[x-apple-data-detectors],
#MessageViewBody a {
  color:inherit!important;
  text-decoration:none!important;
  font-size:inherit!important;
  font-family:inherit!important;
  font-weight:inherit!important;
  line-height:inherit!important;
}
.h {
  display:none;
  float:left;
  overflow:hidden;
  width:0;
  max-height:0;
  line-height:0;
  mso-hide:all;
}
@media only screen and (max-width:600px) {.bi { padding-right:0px!important }  *[class="gmail-fix"] { display:none!important } p, a { line-height:150%!important } h1, h1 a { line-height:120%!important } h2, h2 a { line-height:120%!important } h3, h3 a { line-height:120%!important } h4, h4 a { line-height:120%!important } h5, h5 a { line-height:120%!important } h6, h6 a { line-height:120%!important }  .bf p { }   h1 { font-size:36px!important; text-align:left } h2 { font-size:26px!important; text-align:left } h3 { font-size:20px!important; text-align:left } h4 { font-size:24px!important; text-align:left } h5 { font-size:20px!important; text-align:left } h6 { font-size:16px!important; text-align:left }         .bf p, .bf a { font-size:14px!important }        .z .rollover:hover .rollover-second, .ba .rollover:hover .rollover-second, .bb .rollover:hover .rollover-second { display:inline!important }      .s, .s .t, .u, .u td, .f.e { display:inline-block!important }  .m table, .n table, .o table, .m, .o, .n { width:100%!important; max-width:600px!important } .adapt-img { width:100%!important; height:auto!important }         table.e, .esd-block-html table { width:auto!important } .h-auto { height:auto!important }  .a .b, .a .b * { font-size:13px!important; line-height:150%!important } }
@media screen and (max-width:384px) {.mail-message-content { width:414px!important } }</style>
 </head>
 <body class="body" style="width:100%;height:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0">
  <div dir="ltr" class="es-wrapper-color" lang="en" style="background-color:#FAFAFA"><!--[if gte mso 9]>
			<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
				<v:fill type="tile" color="#fafafa"></v:fill>
			</v:background>
		<![endif]-->
   <table width="100%" cellspacing="0" cellpadding="0" class="es-wrapper" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%;background-repeat:repeat;background-position:center top;background-color:#FAFAFA">
     <tr>
      <td valign="top" style="padding:0;Margin:0">
       <table cellpadding="0" cellspacing="0" align="center" class="m" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;width:100%;table-layout:fixed !important">
         <tr>
          <td align="center" class="es-info-area" style="padding:0;Margin:0">
           <table align="center" cellpadding="0" cellspacing="0" bgcolor="#00000000" class="bf" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;background-color:transparent;width:600px" role="none">
           </table></td>
         </tr>
       </table>
       <table cellpadding="0" cellspacing="0" align="center" class="n" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;width:100%;table-layout:fixed !important;background-color:transparent;background-repeat:repeat;background-position:center top">
         <tr>
          <td align="center" bgcolor="#efefef" style="padding:0;Margin:0;background-color:#efefef">
           <table bgcolor="#ffffff" align="center" cellpadding="0" cellspacing="0" class="bg" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;background-color:#ffffff;width:600px" role="none">
             <tr>
              <td align="left" style="Margin:0;padding-top:10px;padding-right:20px;padding-bottom:10px;padding-left:20px">
               <table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                 <tr>
                  <td valign="top" align="center" class="bi" style="padding:0;Margin:0;width:560px">
                   <table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                     <tr>
                      <td align="center" style="padding:0;Margin:0;padding-bottom:20px;font-size:0px"><img src="https://fosrkjp.stripocdn.email/content/guids/CABINET_6b5c97c15cbee3b523209bc508b74bf9224d4e9d69c794bc91f82b6d232dfe79/images/umattend_logo.png" alt="Logo" width="285" title="Logo" class="adapt-img" style="display:block;font-size:12px;border:0;outline:none;text-decoration:none;margin:0"></td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>
           </table></td>
         </tr>
       </table>
       <table cellpadding="0" cellspacing="0" align="center" class="m" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;width:100%;table-layout:fixed !important">
         <tr>
          <td align="center" bgcolor="#efefef" style="padding:0;Margin:0;background-color:#efefef">
           <table bgcolor="#ffffff" align="center" cellpadding="0" cellspacing="0" class="bf" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;background-color:#FFFFFF;width:600px">
             <tr>
              <td align="left" style="padding:0;Margin:0;padding-right:20px;padding-left:20px">
               <table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                 <tr>
                  <td align="center" valign="top" style="padding:0;Margin:0;width:560px">
                   <table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                     <tr>
                      <td align="left" class="c" style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">Hi {{name}},<br><br>You\u2019ve successfully checked in to {{event_name}}. We\u2019re glad to have you with us! <br><br>Event details:<br>Location: {{event_location}}<br>Date &amp; Time: {{event_date_and_time}}<br>Checked in by: {{checked_in_by}}<br><br>Feel free to explore, connect, and make the most of your experience at the event.<br><br>If you have any questions or need assistance, our team is happy to help.<br><br>Thanks for attending, and enjoy the event!<br><br>Best regards,<br>The UMAttend Team</p></td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>
             <tr>
              <td align="left" style="padding:0;Margin:0;padding-right:20px;padding-left:20px;padding-top:20px">
               <table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                 <tr>
                  <td align="left" style="padding:0;Margin:0;width:560px">
                   <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                     <tr>
                      <td align="center" style="padding:0;Margin:0;padding-top:10px;padding-bottom:15px;padding-left:40px;font-size:0">
                       <table cellpadding="0" cellspacing="0" class="e u" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                         <tr>
                          <td align="center" valign="top" style="padding:0;Margin:0;padding-right:40px"><a target="_blank" href="https://www.facebook.com/cceskillsclinicofficial" style="mso-line-height-rule:exactly;text-decoration:underline;color:#5C68E2;font-size:14px"><img title="Facebook" src="https://fosrkjp.stripocdn.email/content/assets/img/social-icons/logo-black/facebook-logo-black.png" alt="Fb" width="40" height="40" style="display:block;font-size:14px;border:0;outline:none;text-decoration:none;margin:0"></a></td>
                          <td valign="top" align="center" style="padding:0;Margin:0;padding-right:40px"><a href="mailto:cce_csg@umindanao.edu.ph" target="_blank" style="mso-line-height-rule:exactly;text-decoration:underline;color:#5C68E2;font-size:14px"><img src="https://fosrkjp.stripocdn.email/content/assets/img/other-icons/logo-black/gmail-logo-black.png" alt="gm" width="40" title="Gmail" height="40" style="display:block;font-size:14px;border:0;outline:none;text-decoration:none;margin:0"></a></td>
                         </tr>
                       </table></td>
                     </tr>
                     <tr>
                      <td align="center" class="a" style="padding:0;Margin:0;padding-bottom:35px"><p class="b" style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:19.5px;letter-spacing:0;color:#999999;font-size:13px">College of Computing Education Skills Clinic \xA9 2025. All Rights Reserved.</p><p class="b" style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:19.5px;letter-spacing:0;color:#999999;font-size:13px">University of Mindanao - Matina Campus Matina Crossing, Davao City, Davao del Sur, Philippines 8000</p></td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>
           </table></td>
         </tr>
       </table></td>
     </tr>
   </table>
  </div>
 </body>
</html>
`;

// src/v1/queues/email.queue.ts
import { Queue as Queue3, Worker as Worker3 } from "bullmq";

// src/configs/smtp.config.ts
import nodemailer from "nodemailer";

// src/constants/smtp.constants.ts
var MAIL_HOST = envHandler_default("MAIL_HOST");
var MAIL_PORT = parseInt(envHandler_default("MAIL_PORT", false));
var MAIL_SECURE = envHandler_default("MAIL_SECURE", false);
var MAIL_USER = envHandler_default("MAIL_USER");
var MAIL_PASS = envHandler_default("MAIL_PASS");

// src/configs/smtp.config.ts
var transporter = nodemailer.createTransport({
  host: MAIL_HOST,
  port: Number(MAIL_PORT),
  secure: MAIL_SECURE === "true",
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASS
  }
});

// src/v1/queues/email.queue.ts
var connection3 = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};
var emailQueue = new Queue3("email-queue", {
  connection: connection3,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2e3
    },
    removeOnComplete: {
      age: 3600,
      count: 1e3
    },
    removeOnFail: {
      age: 86400
    }
  }
});
var emailWorker = new Worker3(
  "email-queue",
  async (job) => {
    const { to, subject, html } = job.data;
    try {
      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to,
        subject,
        html
      });
      console.log(`Email sent to ${to}`);
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  },
  {
    connection: connection3,
    limiter: {
      max: 1,
      duration: 1e4
    }
  }
);
emailWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed for ${job.data.to}`);
});
emailWorker.on("failed", (job, err) => {
  console.error(
    `Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
    err
  );
});

// src/v1/services/email.service.ts
import { v4 as uuidv42 } from "uuid";
async function sendEmail(to, subject, html) {
  const emailData = { to, subject, html };
  const jobId = uuidv42();
  await emailQueue.add("send-email", emailData, {
    jobId
  });
  console.log(`Queued email to ${to}`);
}

// src/v1/template/checkOut.email.ts
var CHECK_OUT_EMAIL = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
 <head>
  <meta charset="UTF-8">
  <meta content="width=device-width, initial-scale=1" name="viewport">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta content="telephone=no" name="format-detection">
  <title>UMAttend Check Out Email</title><!--[if (mso 16)]>
    <style type="text/css">
    a {text-decoration: none;}
    </style>
    <![endif]--><!--[if gte mso 9]><style>sup { font-size: 100% !important; }</style><![endif]--><!--[if gte mso 9]>
<noscript>
         <xml>
           <o:OfficeDocumentSettings>
           <o:AllowPNG></o:AllowPNG>
           <o:PixelsPerInch>96</o:PixelsPerInch>
           </o:OfficeDocumentSettings>
         </xml>
      </noscript>
<![endif]--><!--[if mso]><xml>
    <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
      <w:DontUseAdvancedTypographyReadingMail/>
    </w:WordDocument>
    </xml><![endif]-->
  <style type="text/css">.rollover:hover .rollover-first {
  max-height:0px!important;
  display:none!important;
}
.rollover:hover .rollover-second {
  max-height:none!important;
  display:block!important;
}
.rollover span {
  font-size:0px;
}
u + .body img ~ div div {
  display:none;
}
#outlook a {
  padding:0;
}
span.MsoHyperlink,
span.MsoHyperlinkFollowed {
  color:inherit;
  mso-style-priority:99;
}
a.t {
  mso-style-priority:100!important;
  text-decoration:none!important;
}
a[x-apple-data-detectors],
#MessageViewBody a {
  color:inherit!important;
  text-decoration:none!important;
  font-size:inherit!important;
  font-family:inherit!important;
  font-weight:inherit!important;
  line-height:inherit!important;
}
.h {
  display:none;
  float:left;
  overflow:hidden;
  width:0;
  max-height:0;
  line-height:0;
  mso-hide:all;
}
@media only screen and (max-width:600px) {.bi { padding-right:0px!important }  *[class="gmail-fix"] { display:none!important } p, a { line-height:150%!important } h1, h1 a { line-height:120%!important } h2, h2 a { line-height:120%!important } h3, h3 a { line-height:120%!important } h4, h4 a { line-height:120%!important } h5, h5 a { line-height:120%!important } h6, h6 a { line-height:120%!important }  .bf p { }   h1 { font-size:36px!important; text-align:left } h2 { font-size:26px!important; text-align:left } h3 { font-size:20px!important; text-align:left } h4 { font-size:24px!important; text-align:left } h5 { font-size:20px!important; text-align:left } h6 { font-size:16px!important; text-align:left }         .bf p, .bf a { font-size:14px!important }        .z .rollover:hover .rollover-second, .ba .rollover:hover .rollover-second, .bb .rollover:hover .rollover-second { display:inline!important }      .s, .s .t, .u, .u td, .f.e { display:inline-block!important }  .m table, .n table, .o table, .m, .o, .n { width:100%!important; max-width:600px!important } .adapt-img { width:100%!important; height:auto!important }         table.e, .esd-block-html table { width:auto!important } .h-auto { height:auto!important }  .a .b, .a .b * { font-size:13px!important; line-height:150%!important } }
@media screen and (max-width:384px) {.mail-message-content { width:414px!important } }</style>
 </head>
 <body class="body" style="width:100%;height:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0">
  <div dir="ltr" class="es-wrapper-color" lang="en" style="background-color:#FAFAFA"><!--[if gte mso 9]>
			<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
				<v:fill type="tile" color="#fafafa"></v:fill>
			</v:background>
		<![endif]-->
   <table width="100%" cellspacing="0" cellpadding="0" class="es-wrapper" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%;background-repeat:repeat;background-position:center top;background-color:#FAFAFA">
     <tr>
      <td valign="top" style="padding:0;Margin:0">
       <table cellpadding="0" cellspacing="0" align="center" class="m" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;width:100%;table-layout:fixed !important">
         <tr>
          <td align="center" class="es-info-area" style="padding:0;Margin:0">
           <table align="center" cellpadding="0" cellspacing="0" bgcolor="#00000000" class="bf" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;background-color:transparent;width:600px" role="none">
           </table></td>
         </tr>
       </table>
       <table cellpadding="0" cellspacing="0" align="center" class="n" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;width:100%;table-layout:fixed !important;background-color:transparent;background-repeat:repeat;background-position:center top">
         <tr>
          <td align="center" bgcolor="#efefef" style="padding:0;Margin:0;background-color:#efefef">
           <table bgcolor="#ffffff" align="center" cellpadding="0" cellspacing="0" class="bg" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;background-color:#ffffff;width:600px" role="none">
             <tr>
              <td align="left" style="Margin:0;padding-top:10px;padding-right:20px;padding-bottom:10px;padding-left:20px">
               <table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                 <tr>
                  <td valign="top" align="center" class="bi" style="padding:0;Margin:0;width:560px">
                   <table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                     <tr>
                      <td align="center" style="padding:0;Margin:0;padding-bottom:20px;font-size:0px"><img src="https://fosrkjp.stripocdn.email/content/guids/CABINET_6b5c97c15cbee3b523209bc508b74bf9224d4e9d69c794bc91f82b6d232dfe79/images/umattend_logo.png" alt="Logo" width="285" title="Logo" class="adapt-img" style="display:block;font-size:12px;border:0;outline:none;text-decoration:none;margin:0"></td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>
           </table></td>
         </tr>
       </table>
       <table cellpadding="0" cellspacing="0" align="center" class="m" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;width:100%;table-layout:fixed !important">
         <tr>
          <td align="center" bgcolor="#efefef" style="padding:0;Margin:0;background-color:#efefef">
           <table bgcolor="#ffffff" align="center" cellpadding="0" cellspacing="0" class="bf" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px;background-color:#FFFFFF;width:600px">
             <tr>
              <td align="left" style="padding:0;Margin:0;padding-right:20px;padding-left:20px">
               <table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                 <tr>
                  <td align="center" valign="top" style="padding:0;Margin:0;width:560px">
                   <table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                     <tr>
                      <td align="left" class="c" style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px"><p style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;letter-spacing:0;color:#333333;font-size:14px">Hi {{name}},<br><br>You\u2019ve successfully checked out from {{event_name}}. We hope you had a great time!<br><br>Event details:<br>Location: {{event_location}}<br>Date &amp; Time: {{event_date_and_time}}<br>Checked out by: {{checked_out_by}}<br><br>Thank you for being part of the event \u2014 we appreciate your participation and hope to see you again soon.<br><br>If you have any questions or feedback, our team is always happy to help.<br><br>Best regards,<br>The UMAttend Team</p></td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>
             <tr>
              <td align="left" style="padding:0;Margin:0;padding-right:20px;padding-left:20px;padding-top:20px">
               <table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                 <tr>
                  <td align="left" style="padding:0;Margin:0;width:560px">
                   <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                     <tr>
                      <td align="center" style="padding:0;Margin:0;padding-top:10px;padding-bottom:15px;padding-left:40px;font-size:0">
                       <table cellpadding="0" cellspacing="0" class="e u" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-spacing:0px">
                         <tr>
                          <td align="center" valign="top" style="padding:0;Margin:0;padding-right:40px"><a target="_blank" href="https://www.facebook.com/umccecsg" style="mso-line-height-rule:exactly;text-decoration:underline;color:#5C68E2;font-size:14px"><img title="Facebook" src="https://fosrkjp.stripocdn.email/content/assets/img/social-icons/logo-black/facebook-logo-black.png" alt="Fb" width="40" height="40" style="display:block;font-size:14px;border:0;outline:none;text-decoration:none;margin:0"></a></td>
                          <td valign="top" align="center" style="padding:0;Margin:0;padding-right:40px"><a href="mailto:cce_csg@umindanao.edu.ph" target="_blank" style="mso-line-height-rule:exactly;text-decoration:underline;color:#5C68E2;font-size:14px"><img src="https://fosrkjp.stripocdn.email/content/assets/img/other-icons/logo-black/gmail-logo-black.png" alt="gm" width="40" title="Gmail" height="40" style="display:block;font-size:14px;border:0;outline:none;text-decoration:none;margin:0"></a></td>
                         </tr>
                       </table></td>
                     </tr>
                     <tr>
                      <td align="center" class="a" style="padding:0;Margin:0;padding-bottom:35px"><p class="b" style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:19.5px;letter-spacing:0;color:#999999;font-size:13px">College of Computing Education Skills Clinic \xA9 2025. All Rights Reserved.</p><p class="b" style="Margin:0;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:19.5px;letter-spacing:0;color:#999999;font-size:13px">University of Mindanao - Matina Campus Matina Crossing, Davao City, Davao del Sur, Philippines 8000</p></td>
                     </tr>
                   </table></td>
                 </tr>
               </table></td>
             </tr>
           </table></td>
         </tr>
       </table></td>
     </tr>
   </table>
  </div>
 </body>
</html>
`;

// src/v1/services/event.service.ts
var addEvent = async (event_data) => {
  try {
    const event2 = await event_repository_default.createEvent(event_data);
    await scheduleStartEventStatusJob(event2);
    await scheduleEndEventStatusJob(event2);
    return event2;
  } catch (error) {
    if (error instanceof Prisma2.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new Error("Unique constraint failed");
      }
      if (error.code === "P2003") {
        throw new Error("Foreign key constraint failed");
      }
    }
    if (error instanceof Prisma2.PrismaClientValidationError && NODE_ENV === "DEVELOPMENT") {
      throw new Error("Validation failed: " + error.message);
    }
    return false;
  }
};
var deleteEvent2 = async (eventId, created_by) => {
  const event2 = await event_repository_default.getEventDetails(eventId);
  if (!event2) {
    throw new NotFoundError("Event not found");
  }
  if (event2.created_by !== created_by) {
    throw new ForbiddenError("You are not authorized to delete this event");
  }
  await event_repository_default.deleteEvent(eventId);
  return true;
};
var updateEvent2 = async (eventId, event_data) => {
  const event2 = await event_repository_default.getEventDetails(eventId);
  if (!event2) {
    throw new NotFoundError("Event not found");
  }
  if (event2.created_by !== event_data.created_by) {
    throw new ForbiddenError("You are not authorized to update this event");
  }
  const updated_event = await event_repository_default.updateEvent(eventId, event_data);
  await Promise.allSettled([
    startEventStatusQueue.remove(`event-start-${updated_event.id}`),
    endEventStatusQueue.remove(`event-done-${updated_event.id}`)
  ]);
  await Promise.all([
    scheduleStartEventStatusJob(updated_event),
    scheduleEndEventStatusJob(updated_event)
  ]);
  return updated_event;
};
var createCheckInEvent2 = async (attendance_data) => {
  try {
    if (!attendance_data.student_id) {
      throw new NotFoundError("Student ID is required");
    }
    const checkedIn = await event_repository_default.createCheckInEvent(attendance_data);
    if (!checkedIn) {
      throw new Error("Failed to create check-in record");
    }
    const studentbyUserId = await student_repository_default.getUserByStudentId(
      attendance_data.student_id
    );
    if (!studentbyUserId) {
      throw new NotFoundError("Student user not found");
    }
    const checkInBy = await student_repository_default.getStudentByUserId(
      checkedIn.check_in_by_user.id
    );
    if (!checkInBy) {
      throw new NotFoundError("Check-in record not found");
    }
    await sendEmail(
      studentbyUserId?.umindanao_email,
      "Event Check-In Successful",
      CHECK_IN_EMAIL.replace("{{name}}", checkedIn.student.name).replace("{{event_name}}", checkedIn.event.title).replace("{{event_location}}", checkedIn.event.location).replace(
        "{{event_date_and_time}}",
        checkedIn.check_in_at.toLocaleString()
      ).replace("{{checked_in_by}}", checkInBy.name)
    );
    return checkedIn;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Prisma2.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new Error("Unique constraint failed");
      }
      if (error.code === "P2003") {
        throw new Error("Foreign key constraint failed");
      }
    }
    if (error instanceof Prisma2.PrismaClientValidationError && NODE_ENV === "DEVELOPMENT") {
      throw new Error("Validation failed: " + error.message);
    }
    console.error(error);
    return false;
  }
};
var createCheckOutEvent2 = async (attendance_data) => {
  try {
    if (!attendance_data.event_id) {
      throw new NotFoundError("Event ID is required");
    }
    const eventDetails = await event_repository_default.getEventDetails(
      attendance_data.event_id
    );
    if (!eventDetails) {
      throw new NotFoundError("Event not found");
    }
    if (!eventDetails.check_out_required) {
      throw new NoCheckoutRequiredError(
        "This event does not require check-out"
      );
    }
    const checkedOut = await event_repository_default.createCheckOutEvent(attendance_data);
    if (!checkedOut) {
      throw new Error("Failed to create check-out record");
    }
    if (!checkedOut.check_out_by_user) {
      throw new NotFoundError("Check-out record not found");
    }
    if (!checkedOut.check_out_at) {
      throw new NotFoundError("Check-out date not found");
    }
    const studentbyUserId = await student_repository_default.getUserByStudentId(
      attendance_data.student_id
    );
    if (!studentbyUserId) {
      throw new NotFoundError("Student user not found");
    }
    const checkOutBy = await student_repository_default.getStudentByUserId(
      checkedOut.check_out_by_user.id
    );
    if (!checkOutBy) {
      throw new NotFoundError("Check-in record not found");
    }
    await sendEmail(
      studentbyUserId?.umindanao_email,
      "Event Check-Out Successful",
      CHECK_OUT_EMAIL.replace("{{name}}", checkedOut.student.name).replace("{{event_name}}", checkedOut.event.title).replace("{{event_location}}", checkedOut.event.location).replace(
        "{{event_date_and_time}}",
        checkedOut.check_out_at.toLocaleString()
      ).replace("{{checked_out_by}}", checkOutBy.name)
    );
    return checkedOut;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Prisma2.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new Error("Unique constraint failed");
      }
      if (error.code === "P2003") {
        throw new Error("Foreign key constraint failed");
      }
    }
    if (error instanceof Prisma2.PrismaClientValidationError && NODE_ENV === "DEVELOPMENT") {
      throw new Error("Validation failed: " + error.message);
    }
    console.error(error);
    return false;
  }
};
var massCheckOutStudents2 = async (event_id, student_ids, check_out_by, checkout_time) => {
  try {
    if (!event_id) {
      throw new NotFoundError("Event ID is required");
    }
    const eventDetails = await event_repository_default.getEventDetails(event_id);
    if (!eventDetails) {
      throw new NotFoundError("Event not found");
    }
    if (!eventDetails.check_out_required) {
      throw new NoCheckoutRequiredError(
        "This event does not require check-out"
      );
    }
    let checkOutAt;
    if (checkout_time instanceof Date) {
      checkOutAt = checkout_time;
    } else if (typeof checkout_time === "string" && /^\d{1,2}:\d{2}$/.test(checkout_time)) {
      const baseDate = eventDetails.start_time ? new Date(eventDetails.start_time) : /* @__PURE__ */ new Date();
      const [hhStr, mmStr] = checkout_time.split(":");
      const hh = String(parseInt(hhStr, 10)).padStart(2, "0");
      const mm = String(parseInt(mmStr, 10)).padStart(2, "0");
      const y = baseDate.getFullYear();
      const m = String(baseDate.getMonth() + 1).padStart(2, "0");
      const d = String(baseDate.getDate()).padStart(2, "0");
      const iso = `${y}-${m}-${d}T${hh}:${mm}:00+08:00`;
      checkOutAt = new Date(iso);
    } else if (typeof checkout_time === "string") {
      const parsed = new Date(checkout_time);
      if (isNaN(parsed.getTime())) {
        throw new Error("Invalid checkout_time format");
      }
      checkOutAt = parsed;
    } else {
      checkOutAt = /* @__PURE__ */ new Date();
    }
    const result = await event_repository_default.massCheckOutStudents(
      event_id,
      student_ids,
      check_out_by,
      checkOutAt
    );
    for (const rec of result.updatedRecords) {
      try {
        const studentbyUserId = await student_repository_default.getUserByStudentId(
          rec.student.student_id
        );
        const checkOutBy = rec.check_out_by_user?.id ? await student_repository_default.getStudentByUserId(rec.check_out_by_user.id) : null;
        if (studentbyUserId && rec.check_out_at && checkOutBy) {
          await sendEmail(
            studentbyUserId.umindanao_email,
            "Event Check-Out Successful",
            CHECK_OUT_EMAIL.replace("{{name}}", rec.student.name).replace("{{event_name}}", rec.event.title).replace("{{event_location}}", rec.event.location).replace(
              "{{event_date_and_time}}",
              rec.check_out_at.toLocaleString()
            ).replace("{{checked_out_by}}", checkOutBy.name)
          );
        }
      } catch (err) {
        console.warn(
          "Failed to send check-out email for student",
          rec.student.student_id,
          err
        );
      }
    }
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
var scheduleEndEventStatusJob = async (event2) => {
  if (!event2.id) {
    return;
  }
  if (!event2.all_day && !event2.end_time) {
    console.warn(`Event ${event2.id} has no end_time, skipping schedule.`);
    return;
  }
  const delay = event2.all_day ? 24 * 60 * 60 * 1e3 : event2.end_time ? Math.max(0, new Date(event2.end_time).getTime() - Date.now()) : 0;
  const jobId = `event-done-${event2.id}`;
  await endEventStatusQueue.add(
    "mark-event-done",
    { event_id: event2.id },
    { delay, jobId }
  );
  console.log(
    `Scheduled event ${event2.id} to be marked done in ${delay / 1e3}s`
  );
};
var scheduleStartEventStatusJob = async (event2) => {
  if (!event2.id) {
    return;
  }
  if (!event2.all_day && !event2.start_time) {
    console.warn(`Event ${event2.id} has no start_time, skipping schedule.`);
    return;
  }
  const delay = event2.all_day ? 0 : event2.start_time ? Math.max(0, new Date(event2.start_time).getTime() - Date.now()) : 0;
  const jobId = `event-start-${event2.id}`;
  await startEventStatusQueue.add(
    "mark-event-started",
    { event_id: event2.id },
    { delay, jobId }
  );
  console.log(
    `Scheduled event ${event2.id} to be marked started in ${delay / 1e3}s`
  );
};
var addOrganizer2 = async (umindanao_email, event_id, added_by) => {
  const user2 = await auth_repository_default.findUserByEmail(umindanao_email);
  if (!user2) {
    throw new NotFoundError("User not found");
  }
  const user_id = user2.id;
  if (!user_id) {
    throw new NotFoundError("User ID not found");
  }
  const existingOrganizer = await event_repository_default.checkOrganizer(
    user_id,
    event_id
  );
  if (existingOrganizer) {
    throw new OrganizerError("User is already an organizer for this event");
  }
  try {
    return await event_repository_default.addOrganizer(user_id, added_by, event_id);
  } catch (error) {
    if (error instanceof Prisma2.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new OrganizerError("User is already an organizer for this event");
    }
    throw error;
  }
};
var removeOrganizer2 = async (umindanao_email, event_id) => {
  const user2 = await auth_repository_default.findUserByEmail(umindanao_email);
  if (!user2) {
    throw new NotFoundError("User not found");
  }
  const user_id = user2.id;
  if (!user_id) {
    throw new NotFoundError("User ID not found");
  }
  const event2 = await event_repository_default.getEventDetails(event_id);
  if (event2?.created_by === user_id) {
    throw new ForbiddenError("Cannot remove the event creator as an organizer");
  }
  return await event_repository_default.removeOrganizer(user_id, event_id);
};
var getOrganizersByEventId2 = async (event_id) => {
  const event2 = await event_repository_default.getEventDetails(event_id);
  if (!event2) {
    throw new NotFoundError("Event not found");
  }
  const organizers = await event_repository_default.getOrganizersByEventId(event_id);
  if (organizers?.length === 0) {
    throw new NotFoundError("No organizers found for this event");
  }
  return organizers;
};
var getEventDetailsById = async (event_id, user_id) => {
  const event2 = await event_repository_default.getEventDetails(event_id);
  if (!event2) {
    throw new NotFoundError("Event not found");
  }
  const checkin_count = await event_repository_default.getEventCheckinCount(event_id);
  let checkout_count = 0;
  if (event2.check_out_required) {
    checkout_count = await event_repository_default.getEventCheckoutCount(event_id);
  }
  const student = await student_repository_default.getStudentByUserId(user_id);
  if (!student) {
    throw new NotFoundError("Student not found");
  }
  const attendanceData = await event_repository_default.checkIfUserAttended(
    event_id,
    student.student_id
  );
  const check_in_at = attendanceData?.check_in_at ?? null;
  const check_out_at = attendanceData?.check_out_at instanceof Date ? attendanceData.check_out_at : null;
  const is_organizer = await event_repository_default.checkOrganizer(user_id, event_id);
  return {
    ...event2,
    capacity: event2.capacity ?? void 0,
    start_time: event2.start_time ?? void 0,
    end_time: event2.end_time ?? void 0,
    can_edit: !!is_organizer,
    checkin_count: checkin_count ?? 0,
    checkout_count,
    user_attendance: {
      check_in_at: check_in_at ?? null,
      check_out_at: check_out_at ?? null
    }
  };
};
var getAllEvents2 = async (user_id) => {
  const events = await event_repository_default.getAllEvents();
  if (events.length === 0) {
    throw new NotFoundError("No events found");
  }
  return Promise.all(
    events.map(async (event2) => {
      const is_organizer = await event_repository_default.checkOrganizer(
        user_id,
        event2.id
      );
      return {
        id: event2.id,
        title: event2.title,
        description: event2.description,
        department: event2.department,
        location: event2.location,
        capacity: event2.capacity ?? void 0,
        all_day: event2.all_day,
        start_time: event2.start_time ?? void 0,
        end_time: event2.end_time ?? void 0,
        check_out_required: event2.check_out_required,
        is_started: event2.is_started,
        created_by: event2.created_by,
        checkin_count: event2.checkin_count ?? 0,
        checkout_count: event2.checkout_count ?? 0,
        can_edit: !!is_organizer
      };
    })
  );
};
var getAllPastEvents2 = async (user_id) => {
  const events = await event_repository_default.getAllPastEvents();
  if (events.length === 0) {
    throw new NotFoundError("No past events found");
  }
  return Promise.all(
    events.map(async (event2) => {
      const is_organizer = await event_repository_default.checkOrganizer(
        user_id,
        event2.id
      );
      return {
        id: event2.id,
        title: event2.title,
        description: event2.description,
        department: event2.department,
        location: event2.location,
        capacity: event2.capacity ?? void 0,
        all_day: event2.all_day,
        start_time: event2.start_time ?? void 0,
        end_time: event2.end_time ?? void 0,
        check_out_required: event2.check_out_required,
        is_done: event2.is_done,
        created_by: event2.created_by,
        checkin_count: event2.checkin_count ?? 0,
        checkout_count: event2.checkout_count ?? 0,
        can_edit: !!is_organizer
      };
    })
  );
};
var getPaginatedAttendeesByEventId2 = async (event_id, page, limit, search) => {
  const { attendees, total } = await event_repository_default.getPaginatedAttendeesByEventId(
    event_id,
    page,
    limit,
    search
  );
  if (total === 0) {
    throw new NotFoundError("No attendees found for this event");
  }
  const result = await Promise.all(
    attendees.map(async (attendee) => {
      const checkInBy = attendee.check_in_by_user?.id ? await student_repository_default.getStudentByUserId(
        attendee.check_in_by_user.id
      ) : null;
      const checkOutBy = attendee.check_out_by_user?.id ? await student_repository_default.getStudentByUserId(
        attendee.check_out_by_user.id
      ) : null;
      return {
        student: {
          id: attendee.student.id,
          user_id: attendee.student.user_id,
          student_id: attendee.student.student_id,
          name: attendee.student.name,
          umindanao_email: attendee.student.user?.umindanao_email,
          department: attendee.student.department,
          program: attendee.student.program,
          profile_picture: attendee.student.profile_picture,
          created_at: attendee.student.created_at,
          updated_at: attendee.student.updated_at,
          check_in_at: attendee.check_in_at,
          check_out_at: attendee.check_out_at,
          check_in_by: checkInBy?.name ?? null,
          check_out_by: checkOutBy?.name ?? null
        }
      };
    })
  );
  return {
    data: result,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};
var getAttendeesByEventId2 = async (event_id) => {
  const attendees = await event_repository_default.getAttendeesByEventId(event_id);
  if (attendees.length === 0) {
    throw new NotFoundError("No attendees found for this event");
  }
  return Promise.all(
    attendees.map(async (attendee) => {
      const checkInBy = attendee.check_in_by_user?.id ? await student_repository_default.getStudentByUserId(
        attendee.check_in_by_user.id
      ) : null;
      const checkOutBy = attendee.check_out_by_user?.id ? await student_repository_default.getStudentByUserId(
        attendee.check_out_by_user.id
      ) : null;
      return {
        student: {
          id: attendee.student.id,
          user_id: attendee.student.user_id,
          student_id: attendee.student.student_id,
          name: attendee.student.name,
          umindanao_email: attendee.student.user?.umindanao_email,
          department: attendee.student.department,
          program: attendee.student.program,
          profile_picture: attendee.student.profile_picture,
          created_at: attendee.student.created_at,
          updated_at: attendee.student.updated_at,
          check_in_at: attendee.check_in_at,
          check_out_at: attendee.check_out_at,
          check_in_by: checkInBy?.name ?? null,
          check_out_by: checkOutBy?.name ?? null
        }
      };
    })
  );
};
var getEventNameById = async (event_id) => {
  const eventData = await event_repository_default.getEventDetails(event_id);
  if (!eventData) {
    throw new NotFoundError("No event found with this ID");
  }
  return eventData.title;
};
var getTotalAttendanceByEventId = async (event_id) => {
  return await event_repository_default.getEventAttendanceCount(event_id);
};
var eventServices = {
  addEvent,
  deleteEvent: deleteEvent2,
  updateEvent: updateEvent2,
  getAllEvents: getAllEvents2,
  createCheckInEvent: createCheckInEvent2,
  createCheckOutEvent: createCheckOutEvent2,
  massCheckOutStudents: massCheckOutStudents2,
  addOrganizer: addOrganizer2,
  removeOrganizer: removeOrganizer2,
  getOrganizersByEventId: getOrganizersByEventId2,
  getEventDetailsById,
  getAllPastEvents: getAllPastEvents2,
  getAttendeesByEventId: getAttendeesByEventId2,
  getEventNameById,
  getPaginatedAttendeesByEventId: getPaginatedAttendeesByEventId2,
  getTotalAttendanceByEventId
};
var event_service_default = eventServices;

// src/utils/export.utils.ts
var formatDate = (date) => {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${mm}${dd}${yyyy}_${hh}${min}${ss}`;
};
var formatDateTime = (date) => {
  if (!date) {
    return "";
  }
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
};
var toKebabCase = (str) => {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
};
var generateExportFileName = (eventId, eventName) => {
  return `${eventId}_${toKebabCase(eventName)}_${formatDate(/* @__PURE__ */ new Date())}.xlsx`;
};

// src/utils/decodeAndVerifyQR.ts
var decodeAndVerifyQR = (qrCode) => {
  const decoded = Buffer.from(qrCode, "base64").toString("utf-8");
  const time = decoded.slice(0, 8);
  const studentId = decoded.slice(8);
  const month = time.slice(0, 2);
  const date = time.slice(2, 4);
  const year = time.slice(4, 6);
  const hour = time.slice(6, 8);
  const now = /* @__PURE__ */ new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentDate = String(now.getDate()).padStart(2, "0");
  const currentYear = String(now.getFullYear()).slice(-2);
  const currentHour = String(now.getHours()).padStart(2, "0");
  const dateMatches = month === currentMonth && date === currentDate && year === currentYear;
  const hourMatches = hour === currentHour;
  const valid = dateMatches && hourMatches;
  return {
    valid,
    student_id: valid ? studentId : null
  };
};

// src/v1/controllers/event.controller.ts
var addEvent2 = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return HTTPErrorResponse(res, 400, errors.array());
    }
    const data = matchedData(req);
    const { id: created_by, umindanao_email } = req.user;
    const {
      title,
      description,
      department,
      location,
      capacity,
      all_day,
      start_time,
      end_time,
      check_out_required,
      is_done
    } = data;
    const event_data = {
      title,
      description,
      department,
      location,
      capacity,
      all_day,
      start_time,
      end_time,
      check_out_required,
      is_done,
      created_by
    };
    if (!event_data) {
      return HTTPErrorResponse(res, 400, "Missing event_data in request body");
    }
    if (!umindanao_email) {
      return HTTPErrorResponse(res, 401, "Unauthorized");
    }
    if (event_data.end_time < event_data.start_time) {
      return HTTPErrorResponse(
        res,
        400,
        "End time cannot be before start time"
      );
    }
    const new_event = await event_service_default.addEvent(event_data);
    if (!umindanao_email) {
      return HTTPErrorResponse(res, 500, "Failed to add event");
    }
    return HTTPSuccessResponse(res, 200, "Event Created", new_event);
  } catch (error) {
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Error: ", error);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.log("Unexpected error adding event:", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var deleteEvent3 = async (req, res) => {
  try {
    const { eventId } = req.params;
    const created_by = req.user?.id;
    if (!eventId) {
      return HTTPErrorResponse(res, 400, "Event ID is required");
    }
    await event_service_default.deleteEvent(eventId, created_by);
    return HTTPSuccessResponse(res, 200, "Event successfully deleted");
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof ForbiddenError) {
      return HTTPErrorResponse(res, 403, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Unexpected error deleting event:", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var updateEvent3 = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return HTTPErrorResponse(res, 400, errors.array());
    }
    const data = matchedData(req);
    const { id: created_by } = req.user;
    const {
      title,
      description,
      department,
      location,
      capacity,
      all_day,
      start_time,
      end_time,
      check_out_required,
      is_done
    } = data;
    const updated_event_data = {
      title,
      description,
      department,
      location,
      capacity,
      all_day,
      start_time,
      end_time,
      check_out_required,
      is_done,
      created_by
    };
    const { eventId } = req.params;
    if (!eventId) {
      return HTTPErrorResponse(res, 400, "Event ID is required");
    }
    const updated_event = await event_service_default.updateEvent(
      eventId,
      updated_event_data
    );
    return HTTPSuccessResponse(
      res,
      200,
      "Event successfully updated",
      updated_event
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof ForbiddenError) {
      return HTTPErrorResponse(res, 403, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Unexpected error updating event:", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var createCheckInEvent3 = async (req, res) => {
  try {
    const { qr_code, event_id } = req.params;
    if (!event_id) {
      return HTTPErrorResponse(res, 400, "event_id is required");
    }
    if (!qr_code) {
      return HTTPErrorResponse(res, 400, "Invalid QR Code");
    }
    let student_id = 0;
    if (qr_code) {
      try {
        const { valid, student_id: qrStudentId } = decodeAndVerifyQR(qr_code);
        if (!valid || !qrStudentId) {
          return HTTPErrorResponse(res, 400, "Invalid or expired QR code");
        }
        student_id = Number(qrStudentId);
      } catch {
        return HTTPErrorResponse(res, 400, "Invalid or expired QR code");
      }
    }
    const { umindanao_email, done_onboarding } = req.user;
    if (!done_onboarding) {
      throw new ForbiddenError("User has not completed onboarding");
    }
    const check_in_data = {
      student_id,
      event_id,
      check_in_by: req.user.id,
      check_in_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!check_in_data) {
      return HTTPErrorResponse(
        res,
        400,
        "Missing check_in_data in request body"
      );
    }
    const checkIn2 = await event_service_default.createCheckInEvent(check_in_data);
    if (!umindanao_email) {
      return HTTPErrorResponse(res, 401, "Unauthorized");
    }
    if (!checkIn2) {
      return HTTPErrorResponse(res, 500, "Failed to create check-in record");
    }
    const responseData = {
      event_id: checkIn2.event_id,
      event_name: checkIn2.event.title,
      checked_in_at: checkIn2.check_in_at,
      checked_in_by: checkIn2.check_in_by
    };
    return HTTPSuccessResponse(res, 200, "Check-in successful", responseData);
  } catch (error) {
    if (error instanceof ConflictError) {
      return HTTPErrorResponse(res, 409, error.message);
    }
    if (error instanceof BadRequestError) {
      return HTTPErrorResponse(res, 400, error.message);
    }
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof ForbiddenError) {
      return HTTPErrorResponse(res, 403, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Unexpected error checking in", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var createCheckOutEvent3 = async (req, res) => {
  try {
    const { qr_code, event_id } = req.params;
    if (!event_id) {
      return HTTPErrorResponse(res, 400, "event_id is required");
    }
    if (!qr_code) {
      return HTTPErrorResponse(res, 400, "Invalid QR Code");
    }
    let student_id = 0;
    if (!student_id && qr_code) {
      try {
        const { valid, student_id: qrStudentId } = decodeAndVerifyQR(qr_code);
        if (!valid || !qrStudentId) {
          return HTTPErrorResponse(res, 400, "Invalid or expired QR code");
        }
        student_id = Number(qrStudentId);
      } catch {
        return HTTPErrorResponse(res, 400, "Invalid or expired QR code");
      }
    }
    const { umindanao_email, done_onboarding } = req.user;
    if (!done_onboarding) {
      throw new ForbiddenError("User has not completed onboarding");
    }
    const check_out_data = {
      student_id,
      event_id,
      check_out_by: req.user.id,
      check_out_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!check_out_data) {
      return HTTPErrorResponse(
        res,
        400,
        "Missing check_out_data in request body"
      );
    }
    const checkOut2 = await event_service_default.createCheckOutEvent(check_out_data);
    if (!umindanao_email) {
      return HTTPErrorResponse(res, 401, "Unauthorized");
    }
    if (!checkOut2) {
      return HTTPErrorResponse(res, 500, "Failed to create check-out record");
    }
    const responseData = {
      event_id: checkOut2.event_id,
      event_name: checkOut2.event.title,
      checked_out_at: checkOut2.check_out_at,
      checked_out_by: checkOut2.check_out_by
    };
    return HTTPSuccessResponse(res, 200, "Check-out successful", responseData);
  } catch (error) {
    if (error instanceof ConflictError) {
      return HTTPErrorResponse(res, 409, error.message);
    }
    if (error instanceof BadRequestError) {
      return HTTPErrorResponse(res, 400, error.message);
    }
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof ForbiddenError) {
      return HTTPErrorResponse(res, 403, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Unexpected error checking out", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var massCheckOutEvent = async (req, res) => {
  try {
    const { event_id } = req.params;
    if (!event_id) {
      return HTTPErrorResponse(res, 400, "event_id is required");
    }
    const { student_ids, checkout_time } = req.body;
    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return HTTPErrorResponse(
        res,
        400,
        "student_ids array is required in the request body"
      );
    }
    const { umindanao_email, done_onboarding } = req.user;
    if (!done_onboarding) {
      throw new ForbiddenError("User has not completed onboarding");
    }
    const result = await event_service_default.massCheckOutStudents(
      event_id,
      student_ids,
      req.user.id,
      checkout_time
    );
    if (!umindanao_email) {
      return HTTPErrorResponse(res, 401, "Unauthorized");
    }
    return HTTPSuccessResponse(res, 200, "Mass check-out completed", result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof ForbiddenError) {
      return HTTPErrorResponse(res, 403, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Unexpected error mass checking out", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var addOrganizer3 = async (req, res) => {
  try {
    const errors = validationResult(req);
    const { id: added_by } = req.user;
    if (!errors.isEmpty()) {
      return HTTPErrorResponse(res, 400, errors.array());
    }
    const data = matchedData(req);
    const { umindanao_email, event_id } = data;
    if (!event_id) {
      return HTTPErrorResponse(res, 400, "Event ID is required");
    }
    if (!umindanao_email) {
      return HTTPErrorResponse(res, 400, "Umindanao email is required");
    }
    const new_organizer = await event_service_default.addOrganizer(
      umindanao_email,
      event_id,
      added_by
    );
    return HTTPSuccessResponse(
      res,
      200,
      "Organizer added successfully",
      new_organizer
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Unexpected error adding organizer:", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var removeOrganizer3 = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return HTTPErrorResponse(res, 400, errors.array());
    }
    const data = matchedData(req);
    const { umindanao_email, event_id } = data;
    if (!event_id) {
      return HTTPErrorResponse(res, 400, "Event ID is required");
    }
    if (!umindanao_email) {
      return HTTPErrorResponse(res, 400, "Umindanao email is required");
    }
    await event_service_default.removeOrganizer(umindanao_email, event_id);
    return HTTPSuccessResponse(
      res,
      200,
      "Organizer removed successfully",
      null
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof ForbiddenError) {
      return HTTPErrorResponse(res, 403, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Unexpected error removing organizer:", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var getEventDetailsById2 = async (req, res) => {
  try {
    const { event_id } = req.params;
    const user_id = req.user?.id;
    if (!event_id) {
      return HTTPErrorResponse(res, 400, "Event ID is required");
    }
    if (!user_id) {
      return HTTPErrorResponse(res, 401, "Unauthorized");
    }
    const event2 = await event_service_default.getEventDetailsById(event_id, user_id);
    return HTTPSuccessResponse(res, 200, "Event details retrieved", event2);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Unexpected error retrieving event details:", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var getOrganizersByEventId3 = async (req, res) => {
  try {
    const { event_id } = req.params;
    if (!event_id) {
      return HTTPErrorResponse(res, 400, "Event ID is required");
    }
    const organizers = await event_service_default.getOrganizersByEventId(event_id);
    return HTTPSuccessResponse(
      res,
      200,
      "Organizers retrieved successfully",
      organizers
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Unexpected error retrieving organizers:", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var getAllEvents3 = async (req, res) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return HTTPErrorResponse(res, 401, "Unauthorized");
    }
    const events = await event_service_default.getAllEvents(user_id);
    return HTTPSuccessResponse(
      res,
      200,
      "Events retrieved successfully",
      events
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Unexpected error retrieving events:", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var getAllPastEvents3 = async (req, res) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return HTTPErrorResponse(res, 401, "Unauthorized");
    }
    const events = await event_service_default.getAllPastEvents(user_id);
    return HTTPSuccessResponse(
      res,
      200,
      "Past events retrieved successfully",
      events
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Unexpected error retrieving events:", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var getPaginatedAttendeesByEventId3 = async (req, res) => {
  try {
    const { event_id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;
    if (!event_id) {
      return HTTPErrorResponse(res, 400, "Event ID is required");
    }
    const { data, pagination } = await event_service_default.getPaginatedAttendeesByEventId(
      event_id,
      page,
      limit,
      search
    );
    return HTTPSuccessResponse(res, 200, "Attendees retrieved successfully", {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages
      }
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Unexpected error retrieving attendees:", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var exportEventAttendeesToExcel = async (req, res) => {
  try {
    const { event_id } = req.params;
    if (!event_id) {
      return HTTPErrorResponse(res, 400, "Event ID is required");
    }
    const attendees = await event_service_default.getAttendeesByEventId(event_id);
    const event_name = await event_service_default.getEventNameById(event_id);
    if (attendees.length === 0) {
      return HTTPErrorResponse(res, 404, "No attendees found for this event");
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Attendees");
    worksheet.columns = [
      { header: "Student ID", key: "student_id", width: 10 },
      { header: "Full Name", key: "full_name", width: 30 },
      { header: "Department", key: "department", width: 30 },
      { header: "Program", key: "program", width: 35 },
      { header: "Email", key: "umindanao_email", width: 35 },
      { header: "Check-In By", key: "check_in_by", width: 30 },
      { header: "Check-In Time", key: "check_in_at", width: 25 },
      { header: "Check-Out By", key: "check_out_by", width: 30 },
      { header: "Check-Out Time", key: "check_out_at", width: 25 }
    ];
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" }
    };
    attendees.forEach((attendee) => {
      worksheet.addRow({
        student_id: attendee.student.student_id,
        full_name: attendee.student.name,
        department: attendee.student.department,
        program: attendee.student.program,
        umindanao_email: attendee.student.umindanao_email,
        check_in_by: attendee.student.check_in_by,
        check_in_at: formatDateTime(attendee.student.check_in_at),
        check_out_by: attendee.student.check_out_by,
        check_out_at: formatDateTime(attendee.student.check_out_at)
      });
    });
    const fileName = generateExportFileName(event_id, event_name);
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error("Unexpected error exporting event attendees:", error);
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var getEventAttendanceCount2 = async (req, res) => {
  try {
    const { event_id } = req.params;
    if (!event_id) {
      return HTTPErrorResponse(res, 400, "Event ID is required");
    }
    const { totalAttendance, totalCheckedOut } = await event_service_default.getTotalAttendanceByEventId(event_id);
    return HTTPSuccessResponse(
      res,
      200,
      "Event attendance count retrieved successfully",
      { totalAttendance, totalCheckedOut }
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === "DEVELOPMENT") {
      console.error(
        "Unexpected error retrieving event attendance count:",
        error
      );
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, "Internal server error");
  }
};
var eventController = {
  addEvent: addEvent2,
  deleteEvent: deleteEvent3,
  updateEvent: updateEvent3,
  createCheckInEvent: createCheckInEvent3,
  createCheckOutEvent: createCheckOutEvent3,
  massCheckOutEvent,
  addOrganizer: addOrganizer3,
  removeOrganizer: removeOrganizer3,
  getOrganizersByEventId: getOrganizersByEventId3,
  getEventDetailsById: getEventDetailsById2,
  getAllEvents: getAllEvents3,
  getAllPastEvents: getAllPastEvents3,
  getPaginatedAttendeesByEventId: getPaginatedAttendeesByEventId3,
  exportEventAttendeesToExcel,
  getEventAttendanceCount: getEventAttendanceCount2
};
var event_controller_default = eventController;

// src/v1/middlewares/role.middleware.ts
var checkRole = (...allowedRoles) => (req, res, next) => {
  const user2 = req.user;
  if (!user2 || !allowedRoles.includes(user2.role)) {
    HTTPErrorResponse(
      res,
      403,
      "You do not have permission to access this resource"
    );
    return;
  }
  next();
};

// src/v1/routes/event.routes.ts
import { checkSchema } from "express-validator";

// src/v1/validators/addEventValidSchema.ts
var EventValidSchema = {
  title: {
    notEmpty: {
      errorMessage: "Title is required"
    },
    isString: {
      errorMessage: "Title must be a string"
    },
    isLength: {
      options: { min: 1, max: 140 },
      errorMessage: "Reason for joining must be between 1 and 139 characters"
    }
  },
  description: {
    notEmpty: {
      errorMessage: "Event description cannot be empty"
    },
    isString: {
      errorMessage: "Event description must be a string"
    },
    isLength: {
      options: { min: 20, max: 500 },
      errorMessage: "Event description must be between 20 and 500 characters"
    }
  },
  department: {
    notEmpty: {
      errorMessage: "College/Department cannot be empty"
    },
    isString: {
      errorMessage: "College/Department must be a string"
    },
    isLength: {
      options: { min: 3 },
      errorMessage: "Select your College Department"
    }
  },
  location: {
    notEmpty: {
      errorMessage: "Location is required"
    },
    isString: {
      errorMessage: "Location must be a string"
    },
    isLength: {
      options: { min: 3, max: 140 },
      errorMessage: "Location must be between 3 and 140 characters"
    }
  },
  capacity: {
    optional: true,
    notEmpty: { errorMessage: "Capacity is required" },
    isInt: { errorMessage: "Capacity must be a number" },
    toInt: true
  },
  all_day: {
    optional: true,
    isBoolean: { errorMessage: "all_day must be boolean" },
    toBoolean: true,
    customSanitizer: {
      options: (value) => value ?? false
      // default false
    }
  },
  start_time: {
    notEmpty: {
      errorMessage: "Start time is required"
    },
    isISO8601: {
      errorMessage: "Start time must be a valid date"
    },
    toDate: true
  },
  end_time: {
    notEmpty: {
      errorMessage: "End time is required"
    },
    isISO8601: {
      errorMessage: "End time must be a valid date"
    },
    toDate: true
  },
  check_out_required: {
    optional: true,
    isBoolean: { errorMessage: "check_out_required must be boolean" },
    toBoolean: true,
    customSanitizer: {
      options: (value) => value ?? false
      // default false
    }
  },
  is_done: {
    optional: true,
    isBoolean: { errorMessage: "is_done must be boolean" },
    toBoolean: true,
    customSanitizer: {
      options: (value) => value ?? false
      // default false
    }
  },
  form_fields: {
    optional: true,
    isArray: {
      options: { min: 1 },
      errorMessage: "Form fields must be an array with at least one item"
    }
  },
  "form_fields.*.field_name": {
    notEmpty: {
      errorMessage: "Field name is required"
    },
    isString: {
      errorMessage: "Field name must be a string"
    },
    isLength: {
      options: { min: 1, max: 140 },
      errorMessage: "Field name must be between 1 and 140 characters"
    }
  },
  "form_fields.*.fieldType": {
    notEmpty: {
      errorMessage: "Field type is required"
    },
    isIn: {
      options: [["dropdown", "short_text", "long_text", "checkbox", "radio"]],
      errorMessage: "Field type must be one of dropdown, short text, long text, checkbox, or radio"
    }
  }
};
var AddOrganizerValidSchema = {
  umindanao_email: {
    notEmpty: {
      errorMessage: "University email cannot be empty"
    },
    isEmail: {
      errorMessage: "Invalid email address"
    },
    matches: {
      options: /^[a-z]\.[a-z]+\.\d{6}@umindanao\.edu\.ph$/,
      errorMessage: "Invalid University Email Address"
    }
  },
  event_id: {
    notEmpty: {
      errorMessage: "Event ID is required"
    },
    isString: {
      errorMessage: "Event ID must be a string"
    },
    isLength: {
      options: { min: 10 },
      errorMessage: "Event ID seems invalid (too short)"
    }
  }
};
var RemoveOrganizerValidSchema = {
  umindanao_email: {
    notEmpty: {
      errorMessage: "University email cannot be empty"
    },
    isEmail: {
      errorMessage: "Invalid email address"
    },
    matches: {
      options: /^[a-z]\.[a-z]+\.\d{6}@umindanao\.edu\.ph$/,
      errorMessage: "Invalid University Email Address"
    }
  },
  event_id: {
    notEmpty: {
      errorMessage: "Event ID is required"
    },
    isString: {
      errorMessage: "Event ID must be a string"
    },
    isLength: {
      options: { min: 10 },
      errorMessage: "Event ID seems invalid (too short)"
    }
  }
};

// src/v1/middlewares/checkOrganizer.middleware.ts
var checkOrganizer2 = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const event_id = req.params.event_id;
    if (!user_id || !event_id) {
      return HTTPErrorResponse(res, 400, "User ID and Event ID are required.");
    }
    const organizer = await event_repository_default.checkOrganizer(user_id, event_id);
    if (!organizer) {
      return HTTPErrorResponse(
        res,
        403,
        "User is not an organizer for this event."
      );
    }
    return next();
  } catch (error) {
    console.error("Organizer check failed:", error);
    HTTPErrorResponse(res, 500, "Failed to verify organizer status.");
  }
};

// src/v1/routes/event.routes.ts
var router3 = express3.Router();
router3.post(
  "/",
  authMiddleware,
  checkRole("admin", "csg"),
  checkSchema(EventValidSchema),
  event_controller_default.addEvent
);
router3.delete(
  "/:eventId",
  authMiddleware,
  checkRole("admin", "csg"),
  event_controller_default.deleteEvent
);
router3.put(
  "/:eventId",
  authMiddleware,
  checkRole("admin", "csg"),
  checkSchema(EventValidSchema),
  event_controller_default.updateEvent
);
router3.post(
  `/check_in/:event_id/:qr_code`,
  authMiddleware,
  checkRole("admin", "csg"),
  checkOrganizer2,
  event_controller_default.createCheckInEvent
);
router3.post(
  `/check_out/:event_id/:qr_code`,
  authMiddleware,
  checkRole("admin", "csg"),
  checkOrganizer2,
  event_controller_default.createCheckOutEvent
);
router3.post(
  `/mass_check_out/:event_id`,
  authMiddleware,
  checkRole("admin", "csg"),
  checkOrganizer2,
  event_controller_default.massCheckOutEvent
);
router3.post(
  `/add_organizer/:event_id`,
  authMiddleware,
  checkRole("admin", "csg"),
  checkOrganizer2,
  checkSchema(AddOrganizerValidSchema),
  event_controller_default.addOrganizer
);
router3.delete(
  `/remove_organizer/:event_id`,
  authMiddleware,
  checkRole("admin", "csg"),
  checkOrganizer2,
  checkSchema(RemoveOrganizerValidSchema),
  event_controller_default.removeOrganizer
);
router3.get("/", authMiddleware, event_controller_default.getAllEvents);
router3.get("/past", authMiddleware, event_controller_default.getAllPastEvents);
router3.get("/:event_id", authMiddleware, event_controller_default.getEventDetailsById);
router3.get(
  "/:event_id/attendees",
  authMiddleware,
  checkRole("admin", "csg"),
  checkOrganizer2,
  event_controller_default.getPaginatedAttendeesByEventId
);
router3.get(
  "/:event_id/organizers",
  authMiddleware,
  checkRole("admin", "csg"),
  checkOrganizer2,
  event_controller_default.getOrganizersByEventId
);
router3.get(
  "/export/:event_id",
  authMiddleware,
  checkRole("admin", "csg"),
  checkOrganizer2,
  event_controller_default.exportEventAttendeesToExcel
);
router3.get(
  "/:event_id/attendance_count",
  authMiddleware,
  checkRole("admin", "csg"),
  checkOrganizer2,
  event_controller_default.getEventAttendanceCount
);
var event_routes_default = router3;

// src/v1/routes/docs.routes.ts
import express4 from "express";
import { apiReference } from "@scalar/express-api-reference";

// src/v1/docs/auth.docs.ts
var refresh = {
  "/auth/refresh": {
    post: {
      tags: ["Authentication"],
      summary: "Refresh access token",
      description: "Refresh the access token using a valid refresh token",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                refresh_token: {
                  type: "string",
                  description: "Refresh token (optional if provided in Authorization header)"
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Token refreshed successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Access Token Refreshed Successfully"
                  },
                  data: {
                    type: "object",
                    properties: {
                      access_token: {
                        type: "string",
                        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - Refresh token is required",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "Refresh token is required"
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized - Token expired or invalid",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Token Expire" }
                }
              }
            }
          }
        },
        404: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Not Found" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var logout = {
  "/auth/logout": {
    post: {
      tags: ["Authentication"],
      summary: "Logout user",
      description: "Logout the currently authenticated user",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Logged out successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  refresh_token: {
                    type: "string",
                    description: "Refresh token (optional if provided in Authorization header)"
                  },
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Logged out successfully"
                  },
                  data: { type: "null" }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string" }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized - Token expired or authentication error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Token Expire" }
                }
              }
            }
          }
        },
        404: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Not Found" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var exchange = {
  "/auth/exchange": {
    post: {
      tags: ["Authentication"],
      summary: "Exchange authorization code",
      description: "Exchange authorization code for tokens",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              title: "Error Response",
              properties: {
                auth_code: {
                  type: "string",
                  description: "Exchange Auth code"
                },
                error_code: {
                  type: "string",
                  description: "Exchange Error code"
                }
              },
              required: ["error_code", "auth_code"]
            }
          }
        }
      },
      responses: {
        200: {
          description: "Code exchanged successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Tokens retrieved" },
                  data: {
                    type: "object",
                    properties: {
                      access_token: {
                        type: "string",
                        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      },
                      refresh_token: {
                        type: "string",
                        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - Missing or invalid exchange code",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Missing exchange code" }
                }
              }
            }
          }
        },
        404: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Not Found" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var loginHistory = {
  "/auth/login-history": {
    get: {
      tags: ["Authentication"],
      summary: "Get login history",
      description: "Retrieve login history for the authenticated user",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Login history retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Login history retrieved"
                  },
                  data: {
                    type: "object",
                    properties: {
                      login_history: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            timestamp: {
                              type: "string",
                              format: "date-time",
                              example: "2025-01-15T10:30:00.000Z"
                            },
                            ipAddress: { type: "string" },
                            userAgent: { type: "string" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var auth = {
  ...refresh,
  ...logout,
  ...exchange,
  ...loginHistory
};

// src/v1/docs/user.docs.ts
var getAndUpdateUser = {
  "/user": {
    get: {
      tags: ["User"],
      summary: "Get user by ID",
      description: "Retrieve user information for the authenticated user",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "User retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "User succesfully fetched"
                  },
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "usr_123e4567" },
                          umindanao_email: {
                            type: "string",
                            example: "j.doe.202301@umindanao.edu.ph"
                          },
                          name: {
                            type: ["string", "null"],
                            example: "Jane Doe"
                          },
                          role: { type: "string", example: "student" },
                          department: {
                            type: ["string", "null"],
                            example: "College of Computer Studies"
                          },
                          program: {
                            type: ["string", "null"],
                            example: "BS Computer Science"
                          },
                          profile_picture: {
                            type: ["string", "null"],
                            example: "https://example.com/avatar.jpg"
                          },
                          done_onboarding: { type: "boolean", example: true }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        404: {
          description: "User not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "User not found" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    },
    put: {
      tags: ["User"],
      summary: "Update user profile",
      description: "Update user profile fields such as department and program",
      security: [{ bearerAuth: [] }],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                department: { type: "string" },
                program: { type: "string" }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "User profile updated successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "User profile updated" },
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          umindanao_email: { type: "string" },
                          name: { type: "string" },
                          department: { type: "string" },
                          program: { type: "string" },
                          done_onboarding: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - no fields to update",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No fields to update" }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var onboarding = {
  "/user/onboarding": {
    post: {
      tags: ["User"],
      summary: "Onboard user",
      description: "Complete user onboarding process",
      security: [{ bearerAuth: [] }],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                department: { type: "string" },
                program: { type: "string" }
              },
              required: ["department", "program"]
            }
          }
        }
      },
      responses: {
        200: {
          description: "User onboarded successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "User succesfully updated"
                  },
                  data: {
                    type: "object",
                    properties: {
                      access_token: {
                        type: "string",
                        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      },
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          email: { type: "string" },
                          name: { type: "string" },
                          department: { type: "string" },
                          program: { type: "string" },
                          done_onboarding: { type: "boolean", example: true }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - Missing fields",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Missing Fields" }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        404: {
          description: "User not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "User not found" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var getUserAttendedEvents4 = {
  "/user/events": {
    get: {
      tags: ["User"],
      summary: "Get user attended events",
      description: "Retrieve all events the user has attended (checked in and checked out)",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "List of attended events retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Attended events fetched successfully"
                  },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          example: "evt_12345"
                        },
                        title: {
                          type: "string",
                          example: "Orientation Day"
                        },
                        start_time: {
                          type: "string",
                          format: "date-time",
                          example: "2025-10-10T08:00:00Z"
                        },
                        end_time: {
                          type: "string",
                          format: "date-time",
                          example: "2025-10-10T10:00:00Z"
                        },
                        check_in_at: {
                          type: "string",
                          format: "date-time",
                          example: "2025-10-10T07:55:00Z"
                        },
                        check_out_at: {
                          type: "string",
                          format: "date-time",
                          example: "2025-10-10T10:05:00Z"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized - No token provided or invalid token",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Unauthorized" }
                }
              }
            }
          }
        },
        404: {
          description: "No attended events found for the user",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "No attended events found"
                  }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "Internal server error"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
var getUserAttendedEventsDetailed4 = {
  "/user/attended-events": {
    get: {
      tags: ["User"],
      summary: "Get user attended events with details",
      description: "Retrieve all events the user has attended with event details including creator name and date/time",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "List of attended events retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Attended events successfully fetched"
                  },
                  data: {
                    type: "object",
                    properties: {
                      events: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: {
                              type: "string",
                              example: "evt_12345"
                            },
                            title: {
                              type: "string",
                              example: "Orientation Day"
                            },
                            created_by: {
                              type: "string",
                              example: "John Doe"
                            },
                            start_time: {
                              type: "string",
                              format: "date-time",
                              example: "2025-10-10T08:00:00Z"
                            },
                            end_time: {
                              type: "string",
                              format: "date-time",
                              example: "2025-10-10T10:00:00Z"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Unauthorized" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "Internal server error"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
var getUserHostedEvents4 = {
  "/user/hosted-events": {
    get: {
      tags: ["User"],
      summary: "Get user hosted events",
      description: "Retrieve all events created/hosted by the user with attendee counts",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "List of hosted events retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Hosted events successfully fetched"
                  },
                  data: {
                    type: "object",
                    properties: {
                      events: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: {
                              type: "string",
                              example: "evt_12345"
                            },
                            title: {
                              type: "string",
                              example: "Tech Workshop 2025"
                            },
                            created_by: {
                              type: "string",
                              example: "Jane Smith"
                            },
                            start_time: {
                              type: "string",
                              format: "date-time",
                              example: "2025-10-15T14:00:00Z"
                            },
                            end_time: {
                              type: "string",
                              format: "date-time",
                              example: "2025-10-15T17:00:00Z"
                            },
                            attendees: {
                              type: "number",
                              example: 42,
                              description: "Number of attendees (check-in count or check-out count if check-out is required)"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Unauthorized" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "Internal server error"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
var user = {
  ...getAndUpdateUser,
  ...onboarding,
  ...getUserAttendedEvents4,
  ...getUserAttendedEventsDetailed4,
  ...getUserHostedEvents4
};

// src/v1/docs/event.docs.ts
var updateAndDeleteEvent = {
  "/event/{event_id}": {
    delete: {
      tags: ["Event"],
      summary: "Delete event",
      description: "Delete an existing event by ID (Admin/CSG only).",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "event_id",
          required: true,
          schema: { type: "string" },
          description: "The unique ID of the event to delete."
        }
      ],
      responses: {
        200: {
          description: "Event deleted successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Event successfully deleted"
                  },
                  data: { type: "null" }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - Event ID is required",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Event ID is required" }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized - authentication required to delete an event",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        403: {
          description: "Forbidden - only Admin/CSG roles can delete events",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string" }
                }
              }
            }
          }
        },
        404: {
          description: "Event not found - the specified event ID does not exist",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Event not found" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    },
    put: {
      tags: ["Event"],
      summary: "Update event",
      description: "Update an existing event by ID (Admin/CSG only).",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "event_id",
          required: true,
          schema: { type: "string" },
          description: "The unique ID of the event to update."
        }
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  minLength: 1,
                  maxLength: 140,
                  default: "Updated Annual Tech Conference 2025",
                  description: "Event title"
                },
                description: {
                  type: "string",
                  minLength: 20,
                  maxLength: 500,
                  default: "Updated Join us for an exciting day of technology talks, networking, and learning from industry experts.",
                  description: "Event description"
                },
                department: {
                  type: "string",
                  minLength: 3,
                  default: "Updated College of Computer Studies",
                  description: "College/Department"
                },
                location: {
                  type: "string",
                  minLength: 3,
                  maxLength: 140,
                  default: "Updated Main Auditorium, Building A",
                  description: "Event location"
                },
                capacity: {
                  type: "integer",
                  default: 100,
                  description: "Updated Event capacity"
                },
                all_day: {
                  type: "boolean",
                  default: false,
                  description: "All day event flag"
                },
                start_time: {
                  type: "string",
                  format: "date-time",
                  default: "2025-10-15T09:00:00Z",
                  example: "2025-10-15T09:00:00.000Z",
                  description: "Event start time (ISO 8601 format)"
                },
                end_time: {
                  type: "string",
                  format: "date-time",
                  default: "2025-10-15T17:00:00Z",
                  example: "2025-10-15T17:00:00.000Z",
                  description: "Event end time (ISO 8601 format)"
                },
                check_out_required: {
                  type: "boolean",
                  default: false,
                  description: "Check out required flag"
                },
                is_done: {
                  type: "boolean",
                  default: false,
                  description: "Event completion status"
                },
                form_fields: {
                  type: "array",
                  minItems: 1,
                  default: [
                    {
                      field_name: "Dietary Restrictions",
                      fieldType: "short_text"
                    },
                    {
                      field_name: "T-Shirt Size",
                      fieldType: "dropdown"
                    }
                  ],
                  items: {
                    type: "object",
                    properties: {
                      field_name: {
                        type: "string",
                        minLength: 1,
                        maxLength: 140,
                        default: "Sample Field",
                        description: "Form field name"
                      },
                      fieldType: {
                        type: "string",
                        enum: [
                          "dropdown",
                          "short_text",
                          "long_text",
                          "checkbox",
                          "radio"
                        ],
                        default: "short_text",
                        description: "Form field type"
                      }
                    },
                    required: ["field_name", "fieldType"]
                  },
                  description: "Custom form fields"
                }
              },
              required: [
                "title",
                "description",
                "department",
                "location",
                "start_time",
                "end_time"
              ]
            }
          }
        }
      },
      responses: {
        200: {
          description: "Event updated successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Event successfully updated"
                  },
                  data: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      description: { type: "string" },
                      department: { type: "string" },
                      location: { type: "string" },
                      capacity: {
                        oneOf: [{ type: "number" }, { type: "null" }]
                      },
                      all_day: { type: "boolean" },
                      start_time: {
                        type: "string",
                        format: "date-time",
                        example: "2025-10-15T09:00:00.000Z"
                      },
                      end_time: {
                        type: "string",
                        format: "date-time",
                        example: "2025-10-15T17:00:00.000Z"
                      },
                      check_out_required: { type: "boolean" },
                      is_done: { type: "boolean" }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - invalid or missing update fields",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Event ID is required" }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized - authentication required to update an event",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        403: {
          description: "Forbidden - only Admin/CSG roles can update events",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string" }
                }
              }
            }
          }
        },
        404: {
          description: "Event not found - cannot update a non-existent event",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Event not found" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    },
    get: {
      tags: ["Event"],
      summary: "Get event details by ID",
      description: "Retrieve detailed information about a specific event including check-in/check-out counts and edit permissions",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "event_id",
          required: true,
          schema: { type: "string" },
          description: "The unique ID of the event"
        }
      ],
      responses: {
        200: {
          description: "Event details retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Event details retrieved"
                  },
                  data: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        example: "123e4567-e89b-12d3-a456-426614174000"
                      },
                      title: {
                        type: "string",
                        example: "Annual Tech Conference 2025"
                      },
                      description: {
                        type: "string",
                        example: "Join us for an exciting day of technology talks, networking, and learning from industry experts."
                      },
                      department: {
                        type: "string",
                        example: "College of Computer Studies"
                      },
                      location: {
                        type: "string",
                        example: "Main Auditorium, Building A"
                      },
                      capacity: {
                        oneOf: [{ type: "number" }, { type: "null" }],
                        example: 100,
                        description: "Maximum event capacity"
                      },
                      all_day: {
                        type: "boolean",
                        example: false,
                        description: "Whether the event is an all-day event"
                      },
                      start_time: {
                        type: "string",
                        format: "date-time",
                        example: "2025-10-15T09:00:00.000Z",
                        description: "Event start time"
                      },
                      end_time: {
                        type: "string",
                        format: "date-time",
                        example: "2025-10-15T17:00:00.000Z",
                        description: "Event end time"
                      },
                      check_out_required: {
                        type: "boolean",
                        example: true,
                        description: "Whether check-out is required for the event"
                      },
                      is_done: {
                        type: "boolean",
                        example: false,
                        description: "Whether the event is marked as completed"
                      },
                      checkin_count: {
                        type: "number",
                        example: 45,
                        description: "Number of attendees who have checked in"
                      },
                      checkout_count: {
                        type: "number",
                        example: 40,
                        description: "Number of attendees who have checked out (only if check_out_required is true)"
                      },
                      created_by: {
                        type: "string",
                        example: "123e4567-e89b-12d3-a456-426614174001",
                        description: "User ID of the event creator"
                      },
                      can_edit: {
                        type: "boolean",
                        example: true,
                        description: "Whether the current user has permission to edit this event"
                      },
                      user_attendance: {
                        type: "object",
                        description: "The current user's attendance information for this event",
                        properties: {
                          check_in_at: {
                            type: ["string", "null"],
                            format: "date-time",
                            example: "2025-10-15T09:15:00.000Z",
                            description: "When the user checked in to the event, or null if not checked in"
                          },
                          check_out_at: {
                            type: ["string", "null"],
                            format: "date-time",
                            example: "2025-10-15T16:45:00.000Z",
                            description: "When the user checked out from the event, or null if not checked out"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - Event ID is required",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Event ID is required" }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized - authentication required",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        404: {
          description: "Event not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Event not found" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var checkIn = {
  "/event/check_in/{event_id}/{qr_code}": {
    post: {
      tags: ["Event"],
      summary: "Check in user",
      description: "Check in a user to an event (Admin/CSG/Organizer only). The controller expects a QR code path parameter which will be decoded to obtain the student_id.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "event_id",
          required: true,
          schema: { type: "string" },
          description: "Event ID"
        },
        {
          in: "path",
          name: "qr_code",
          required: true,
          schema: { type: "string" },
          description: "QR code token (required). The server will decode and verify it to obtain the student_id."
        }
      ],
      responses: {
        200: {
          description: "User checked in successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Check-in successful" },
                  data: {
                    type: "object",
                    properties: {
                      event_id: { type: "string" },
                      event_name: { type: "string" },
                      checked_in_at: {
                        type: "string",
                        format: "date-time",
                        example: "2025-10-15T09:30:00.000Z"
                      },
                      checked_in_by: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - Missing required fields",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "student_id and event_id are required"
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Unauthorized" }
                }
              }
            }
          }
        },
        403: {
          description: "Forbidden - User has not completed onboarding",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "User has not completed onboarding"
                  }
                }
              }
            }
          }
        },
        404: {
          description: "User or event not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string" }
                }
              }
            }
          }
        },
        409: {
          description: "Student is already checked in to this event",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "Student is already checked in to this event"
                  }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var checkOut = {
  "/event/check_out/{event_id}/{qr_code}": {
    post: {
      tags: ["Event"],
      summary: "Check out user",
      description: "Check out a user from an event (Admin/CSG/Organizer only). The controller expects a QR code path parameter which will be decoded to obtain the student_id.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "event_id",
          required: true,
          schema: { type: "string" },
          description: "Event ID"
        },
        {
          in: "path",
          name: "qr_code",
          required: true,
          schema: { type: "string" },
          description: "QR code token (required). The server will decode and verify it to obtain the student_id."
        }
      ],
      responses: {
        200: {
          description: "User checked out successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Check-out successful" },
                  data: {
                    type: "object",
                    properties: {
                      event_id: { type: "string" },
                      event_name: { type: "string" },
                      checked_out_at: {
                        type: "string",
                        format: "date-time",
                        example: "2025-10-15T17:30:00.000Z"
                      },
                      checked_out_by: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - Missing required fields",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "student_id and event_id are required"
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Unauthorized" }
                }
              }
            }
          }
        },
        403: {
          description: "Forbidden - User has not completed onboarding",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "User has not completed onboarding"
                  }
                }
              }
            }
          }
        },
        404: {
          description: "User or event not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string" }
                }
              }
            }
          }
        },
        409: {
          description: "Student has already checked out, or student has already checked out of this event",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "Student has already checked out of this event"
                  }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var addOrganizer4 = {
  "/event/add_organizer/{event_id}": {
    post: {
      tags: ["Event"],
      summary: "Add organizer",
      description: "Add an organizer to an event (Admin/CSG/Organizer only)",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "event_id",
          required: true,
          schema: { type: "string" },
          description: "Event ID"
        }
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                umindanao_email: {
                  type: "string",
                  description: "umindanao email of the organizer to add"
                }
              },
              required: ["umindanao_email"]
            }
          }
        }
      },
      responses: {
        200: {
          description: "Organizer added successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Organizer added successfully"
                  },
                  data: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      user_id: { type: "string" },
                      event_id: { type: "string" },
                      added_by: { type: "string" },
                      created_at: {
                        type: "string",
                        format: "date-time",
                        example: "2025-10-15T08:00:00.000Z"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - Missing required fields or validation errors",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Event ID is required" }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        403: {
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Access denied" }
                }
              }
            }
          }
        },
        404: {
          description: "Event or user not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var removeOrganizer4 = {
  "/event/remove_organizer/{event_id}": {
    delete: {
      tags: ["Event"],
      summary: "Remove organizer",
      description: "Remove an organizer from an event (Admin/CSG/Organizer only). The event creator cannot be removed.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "event_id",
          required: true,
          schema: { type: "string" },
          description: "Event ID"
        }
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                umindanao_email: {
                  type: "string",
                  description: "umindanao email of the organizer to remove"
                }
              },
              required: ["umindanao_email"]
            }
          }
        }
      },
      responses: {
        200: {
          description: "Organizer removed successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Organizer removed successfully"
                  },
                  data: { type: "null" }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - Missing required fields or validation errors",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Event ID is required" }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        403: {
          description: "Forbidden - Cannot remove event creator or insufficient permissions",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "Cannot remove the event creator as an organizer"
                  }
                }
              }
            }
          }
        },
        404: {
          description: "Event, user, or organizer record not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "User not found" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var createAndGetEvent = {
  "/event": {
    post: {
      tags: ["Event"],
      summary: "Create event",
      description: "Create a new event (Admin/CSG only)",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  minLength: 1,
                  maxLength: 140,
                  default: "Annual Tech Conference 2025",
                  description: "Event title"
                },
                description: {
                  type: "string",
                  minLength: 20,
                  maxLength: 500,
                  default: "Join us for an exciting day of technology talks, networking, and learning from industry experts.",
                  description: "Event description"
                },
                department: {
                  type: "string",
                  minLength: 3,
                  default: "College of Computer Studies",
                  description: "College/Department"
                },
                location: {
                  type: "string",
                  minLength: 3,
                  maxLength: 140,
                  default: "Main Auditorium, Building A",
                  description: "Event location"
                },
                capacity: {
                  type: "integer",
                  default: 100,
                  description: "Event capacity",
                  nullable: true
                },
                all_day: {
                  type: "boolean",
                  default: false,
                  description: "All day event flag"
                },
                start_time: {
                  type: "string",
                  format: "date-time",
                  default: "2025-10-15T09:00:00Z",
                  example: "2025-10-15T09:00:00.000Z",
                  description: "Event start time (ISO 8601 format)"
                },
                end_time: {
                  type: "string",
                  format: "date-time",
                  default: "2025-10-15T17:00:00Z",
                  example: "2025-10-15T17:00:00.000Z",
                  description: "Event end time (ISO 8601 format)"
                },
                check_out_required: {
                  type: "boolean",
                  default: false,
                  description: "Check out required flag"
                },
                is_done: {
                  type: "boolean",
                  default: false,
                  description: "Event completion status"
                },
                form_fields: {
                  type: "array",
                  minItems: 1,
                  default: [
                    {
                      field_name: "Dietary Restrictions",
                      fieldType: "short_text"
                    },
                    {
                      field_name: "T-Shirt Size",
                      fieldType: "dropdown"
                    }
                  ],
                  items: {
                    type: "object",
                    properties: {
                      field_name: {
                        type: "string",
                        minLength: 1,
                        maxLength: 140,
                        default: "Sample Field",
                        description: "Form field name"
                      },
                      fieldType: {
                        type: "string",
                        enum: [
                          "dropdown",
                          "short_text",
                          "long_text",
                          "checkbox",
                          "radio"
                        ],
                        default: "short_text",
                        description: "Form field type"
                      }
                    },
                    required: ["field_name", "fieldType"]
                  },
                  description: "Custom form fields"
                }
              },
              required: [
                "title",
                "description",
                "department",
                "location",
                "start_time",
                "end_time"
              ]
            }
          }
        }
      },
      responses: {
        200: {
          description: "Event created successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Event Created" },
                  data: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      description: { type: "string" },
                      department: { type: "string" },
                      location: { type: "string" },
                      capacity: {
                        oneOf: [{ type: "number" }, { type: "null" }]
                      },
                      all_day: { type: "boolean" },
                      start_time: {
                        type: "string",
                        format: "date-time",
                        example: "2025-10-15T09:00:00.000Z"
                      },
                      end_time: {
                        type: "string",
                        format: "date-time",
                        example: "2025-10-15T17:00:00.000Z"
                      },
                      check_out_required: { type: "boolean" },
                      is_done: { type: "boolean" },
                      created_by: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - Validation errors",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "array", items: { type: "object" } }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Unauthorized" }
                }
              }
            }
          }
        },
        403: {
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Access denied" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    },
    get: {
      tags: ["Event"],
      summary: "Get all events",
      description: "Retrieve all active (ongoing) events ordered by start time",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Events retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Events retrieved successfully"
                  },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          example: "123e4567-e89b-12d3-a456-426614174000"
                        },
                        title: {
                          type: "string",
                          example: "Annual Tech Conference 2025"
                        },
                        description: {
                          type: "string",
                          example: "Join us for an exciting day of technology talks and networking."
                        },
                        department: {
                          type: "string",
                          example: "College of Computer Studies"
                        },
                        location: {
                          type: "string",
                          example: "Main Auditorium, Building A"
                        },
                        capacity: {
                          oneOf: [{ type: "number" }, { type: "null" }],
                          example: 100
                        },
                        all_day: { type: "boolean", example: false },
                        start_time: {
                          type: "string",
                          format: "date-time",
                          example: "2025-10-15T09:00:00.000Z"
                        },
                        end_time: {
                          type: "string",
                          format: "date-time",
                          example: "2025-10-15T17:00:00.000Z"
                        },
                        check_out_required: { type: "boolean", example: true },
                        is_started: { type: "boolean", example: false },
                        created_by: {
                          type: "string",
                          example: "123e4567-e89b-12d3-a456-426614174001"
                        },
                        checkin_count: {
                          type: "number",
                          example: 25
                        },
                        checkout_count: {
                          type: "number",
                          example: 20
                        },
                        can_edit: {
                          type: "boolean",
                          example: false
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized - authentication required",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        404: {
          description: "No events found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No events found" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var getAllPastEvents4 = {
  "/event/past": {
    get: {
      tags: ["Event"],
      summary: "Get all past events",
      description: "Retrieve all past (completed) events ordered by start time",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Events retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Events retrieved successfully"
                  },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          example: "123e4567-e89b-12d3-a456-426614174000"
                        },
                        title: {
                          type: "string",
                          example: "Annual Tech Conference 2025"
                        },
                        description: {
                          type: "string",
                          example: "Join us for an exciting day of technology talks and networking."
                        },
                        department: {
                          type: "string",
                          example: "College of Computer Studies"
                        },
                        location: {
                          type: "string",
                          example: "Main Auditorium, Building A"
                        },
                        capacity: {
                          oneOf: [{ type: "number" }, { type: "null" }],
                          example: 100
                        },
                        all_day: { type: "boolean", example: false },
                        start_time: {
                          type: "string",
                          format: "date-time",
                          example: "2025-10-15T09:00:00.000Z"
                        },
                        end_time: {
                          type: "string",
                          format: "date-time",
                          example: "2025-10-15T17:00:00.000Z"
                        },
                        check_out_required: { type: "boolean", example: true },
                        is_done: { type: "boolean", example: true },
                        created_by: {
                          type: "string",
                          example: "123e4567-e89b-12d3-a456-426614174001"
                        },
                        checkin_count: {
                          type: "number",
                          example: 25
                        },
                        checkout_count: {
                          type: "number",
                          example: 20
                        },
                        can_edit: {
                          type: "boolean",
                          example: false
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized - authentication required",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        404: {
          description: "No events found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No events found" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var getPaginatedAttendeesByEventId4 = {
  "/event/{event_id}/attendees": {
    get: {
      tags: ["Event"],
      summary: "Get paginated attendees by event ID",
      description: "Retrieve a paginated list of attendees for a specific event, including check-in/check-out details and pagination metadata. Supports search by name, student ID, or email.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "event_id",
          required: true,
          schema: { type: "string" },
          description: "The unique ID of the event"
        },
        {
          in: "query",
          name: "page",
          required: false,
          schema: { type: "integer", example: 1, minimum: 1 },
          description: "Page number for pagination (default: 1)"
        },
        {
          in: "query",
          name: "limit",
          required: false,
          schema: { type: "integer", example: 10, minimum: 1 },
          description: "Number of attendees per page (default: 10)"
        },
        {
          in: "query",
          name: "search",
          required: false,
          schema: { type: "string", example: "John" },
          description: "Search term to filter attendees by name, student ID, or email (case-insensitive)"
        }
      ],
      responses: {
        200: {
          description: "Attendees retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Attendees retrieved successfully"
                  },
                  data: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            student: {
                              type: "object",
                              properties: {
                                id: {
                                  type: "string",
                                  example: "123e4567-e89b-12d3-a456-426614174002"
                                },
                                user_id: {
                                  type: "string",
                                  example: "123e4567-e89b-12d3-a456-426614174003"
                                },
                                student_id: {
                                  type: "number",
                                  example: 2023001
                                },
                                name: { type: "string", example: "Jane Doe" },
                                umindanao_email: {
                                  type: ["string", "null"],
                                  example: "jane.doe@umindanao.edu.ph",
                                  description: "May be null if user email not set"
                                },
                                department: {
                                  type: "string",
                                  example: "College of Computer Studies"
                                },
                                program: {
                                  type: "string",
                                  example: "Bachelor of Science in Computer Science"
                                },
                                profile_picture: {
                                  type: "string",
                                  example: "https://example.com/profile.jpg"
                                },
                                created_at: {
                                  type: "string",
                                  format: "date-time",
                                  example: "2025-09-01T08:00:00.000Z"
                                },
                                updated_at: {
                                  type: "string",
                                  format: "date-time",
                                  example: "2025-09-01T08:00:00.000Z"
                                },
                                check_in_at: {
                                  type: ["string", "null"],
                                  format: "date-time",
                                  example: "2025-10-15T09:15:00.000Z",
                                  description: "Null if student has not checked in"
                                },
                                check_out_at: {
                                  type: ["string", "null"],
                                  format: "date-time",
                                  example: null,
                                  description: "Null if student has not checked out"
                                },
                                check_in_by: {
                                  type: ["string", "null"],
                                  example: "John Admin",
                                  description: "Name of admin who checked in student"
                                },
                                check_out_by: {
                                  type: ["string", "null"],
                                  example: null,
                                  description: "Name of admin who checked out student"
                                }
                              }
                            }
                          }
                        }
                      },
                      pagination: {
                        type: "object",
                        properties: {
                          page: { type: "integer", example: 1 },
                          limit: { type: "integer", example: 10 },
                          total: { type: "integer", example: 47 },
                          totalPages: { type: "integer", example: 5 }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Invalid request or missing parameters",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Validation error" }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized - authentication required",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        403: {
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Access denied" }
                }
              }
            }
          }
        },
        404: {
          description: "Event not found or no attendees found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "Event not found or no attendees for this event"
                  }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var getOrganizersByEventId4 = {
  "/event/{event_id}/organizers": {
    get: {
      tags: ["Event"],
      summary: "Get event organizers",
      description: "Retrieve the list of organizers for a specific event (Admin/CSG/Organizer only).",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "event_id",
          required: true,
          schema: { type: "string" },
          description: "The unique ID of the event"
        }
      ],
      responses: {
        200: {
          description: "Organizers retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: {
                    type: "string",
                    example: "Organizers retrieved successfully"
                  },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        student_id: {
                          type: ["number", "null"],
                          example: 2023001,
                          description: "Student ID number"
                        },
                        name: {
                          type: "string",
                          example: "John Doe",
                          description: "Organizer full name"
                        },
                        department: {
                          type: "string",
                          example: "College of Computer Studies",
                          description: "Department/College"
                        },
                        program: {
                          type: "string",
                          example: "Bachelor of Science in Computer Science",
                          description: "Program/Course"
                        },
                        umindanao_email: {
                          type: "string",
                          example: "j.doe.202301@umindanao.edu.ph",
                          description: "UMindanao email address"
                        },
                        added_by: {
                          type: "string",
                          example: "Jane Admin",
                          description: "Name of the user who added this organizer"
                        },
                        added_at: {
                          type: "string",
                          format: "date-time",
                          example: "2025-10-15T08:00:00.000Z",
                          description: "Date and time when organizer was added"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Bad request - Event ID is required",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Event ID is required" }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        403: {
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Access denied" }
                }
              }
            }
          }
        },
        404: {
          description: "Event not found or no organizers found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: {
                    type: "string",
                    example: "No organizers found for this event"
                  }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var exportEventAttendeesToExcel2 = {
  "/event/export/{event_id}": {
    get: {
      tags: ["Event"],
      summary: "Export event attendees",
      description: "Export the list of attendees for a specific event to an Excel file `xlsx` (Admin/CSG/Organizer only).",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "path",
          name: "event_id",
          required: true,
          schema: { type: "string" },
          description: "The unique ID of the event"
        }
      ],
      responses: {
        200: {
          description: "Excel file generated successfully",
          content: {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
              schema: {
                type: "string",
                format: "binary",
                description: "Binary Excel file content"
              }
            }
          }
        },
        400: {
          description: "Bad request - Event ID is required",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Event ID is required" }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No token provided" }
                }
              }
            }
          }
        },
        403: {
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "Access Denied" }
                }
              }
            }
          }
        },
        404: {
          description: "Event not found - the specified event ID does not exist",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Event not found" }
                }
              }
            }
          }
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Internal server error" }
                }
              }
            }
          }
        }
      }
    }
  }
};
var getEventAttendanceCount3 = {
  "/event/{event_id}/attendance_count": {
    get: {
      summary: "Get event attendance count",
      description: "Returns the total number of attendees and total checked-out attendees for a specific event.\n\n- Requires authentication.\n- Only accessible by users with roles: **admin** or **csg**.\n- Organizer permission check is enforced.",
      tags: ["Event"],
      operationId: "getEventAttendanceCount",
      security: [
        {
          bearerAuth: []
        }
      ],
      parameters: [
        {
          name: "event_id",
          in: "path",
          required: true,
          description: "The unique identifier of the event.",
          schema: {
            type: "string",
            example: ""
          }
        }
      ],
      responses: {
        "200": {
          description: "Event attendance count retrieved successfully.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    example: "success"
                  },
                  message: {
                    type: "string",
                    example: "Event attendance count retrieved successfully"
                  },
                  data: {
                    type: "object",
                    properties: {
                      totalAttendance: {
                        type: "integer",
                        description: "Total number of attendees who have checked in.",
                        example: 150
                      },
                      totalCheckedOut: {
                        type: "integer",
                        description: "Total number of attendees who have checked out.",
                        example: 120
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "400": {
          description: "Missing event ID parameter.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    example: "error"
                  },
                  message: {
                    type: "string",
                    example: "Event ID is required."
                  }
                }
              }
            }
          }
        },
        "404": {
          description: "Event not found.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    example: "error"
                  },
                  message: {
                    type: "string",
                    example: "Event not found."
                  }
                }
              }
            }
          }
        },
        "500": {
          description: "Internal server error.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    example: "error"
                  },
                  message: {
                    type: "string",
                    example: "Internal server error."
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
var event = {
  ...createAndGetEvent,
  ...updateAndDeleteEvent,
  ...checkIn,
  ...checkOut,
  ...addOrganizer4,
  ...removeOrganizer4,
  ...getAllPastEvents4,
  ...getPaginatedAttendeesByEventId4,
  ...getOrganizersByEventId4,
  ...exportEventAttendeesToExcel2,
  ...getEventAttendanceCount3
};

// src/v1/routes/docs.routes.ts
var router4 = express4.Router();
var openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "UMAttend API",
    version: "1.0.0",
    description: "API documentation for the UMAttend application.\n\nTo obtain a token, please log in through the frontend application. After logging in, retrieve the access token and refresh token from your browser\u2019s storage."
  },
  servers: [
    {
      url: "/api/v1",
      description: "API v1"
    }
  ],
  externalDocs: {
    description: "Open UMAttend Frontend",
    url: FRONTEND_URL
  },
  paths: {
    ...auth,
    ...user,
    ...event
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your JWT token"
      }
    }
  }
};
if (NODE_ENV === "PRODUCTION") {
  router4.use((req, res) => {
    res.status(403).json({
      error: "Documentation is not available in production environment"
    });
  });
}
router4.get("/openapi.json", (req, res) => {
  res.json(openApiSpec);
});
router4.use(
  "/",
  apiReference({
    theme: "deepSpace",
    spec: {
      content: openApiSpec
    }
  })
);
var docs_routes_default = router4;

// src/v1/routes/health.routes.ts
import { Router } from "express";

// src/v1/controllers/health.controller.ts
var getHealth = async (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV
  });
};
var getHealthDetailed = async (req, res) => {
  const healthCheck = {
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    server: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
        external: Math.round(process.memoryUsage().external / 1024 / 1024) + " MB"
      },
      cpu: process.cpuUsage()
    },
    database: {
      status: "unknown",
      responseTime: 0
    }
  };
  try {
    const start = Date.now();
    await prisma_config_default.$queryRaw`SELECT 1`;
    const end = Date.now();
    healthCheck.database.status = "connected";
    healthCheck.database.responseTime = end - start;
  } catch (error) {
    healthCheck.status = "degraded";
    healthCheck.database.status = "disconnected";
    console.error("Database health check failed:", error);
  }
  const statusCode = healthCheck.status === "ok" ? 200 : 503;
  res.status(statusCode).json(healthCheck);
};

// src/v1/routes/health.routes.ts
var router5 = Router();
router5.get("/", getHealth);
router5.get("/detailed", getHealthDetailed);
var health_routes_default = router5;

// src/app.ts
var app = express5();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(cacheControl);
app.use(cookieParser());
app.use(express5.json({ limit: "10mb" }));
app.use(express5.urlencoded({ extended: true, limit: "10mb" }));
var allowedOrigins = ALLOWED_ORIGINS.split(",").map(
  (origin) => origin.trim()
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`Blocked by CORS: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  })
);
app.use("/api/v1/health", health_routes_default);
app.use("/api/v1/auth", auth_routes_default);
app.use("/api/v1/user", user_routes_default);
app.use("/api/v1/event", event_routes_default);
if (NODE_ENV !== "PRODUCTION") {
  app.use("/api/v1/docs", docs_routes_default);
}
if (NODE_ENV === "PRODUCTION") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distPath = path.join(__dirname, "../client/dist");
  app.use(express5.static(distPath));
  app.use((req, res) => {
    const now = (/* @__PURE__ */ new Date()).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
    const asciiArt = `
                                                                                                                                                                                                
                                                                                                                                                                                                
UUUUUUUU     UUUUUUUUMMMMMMMM               MMMMMMMM               AAA         TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTEEEEEEEEEEEEEEEEEEEEEENNNNNNNN        NNNNNNNNDDDDDDDDDDDDD        
U::::::U     U::::::UM:::::::M             M:::::::M              A:::A        T:::::::::::::::::::::TT:::::::::::::::::::::TE::::::::::::::::::::EN:::::::N       N::::::ND::::::::::::DDD     
U::::::U     U::::::UM::::::::M           M::::::::M             A:::::A       T:::::::::::::::::::::TT:::::::::::::::::::::TE::::::::::::::::::::EN::::::::N      N::::::ND:::::::::::::::DD   
UU:::::U     U:::::UUM:::::::::M         M:::::::::M            A:::::::A      T:::::TT:::::::TT:::::TT:::::TT:::::::TT:::::TEE::::::EEEEEEEEE::::EN:::::::::N     N::::::NDDD:::::DDDDD:::::D  
 U:::::U     U:::::U M::::::::::M       M::::::::::M           A:::::::::A     TTTTTT  T:::::T  TTTTTTTTTTTT  T:::::T  TTTTTT  E:::::E       EEEEEEN::::::::::N    N::::::N  D:::::D    D:::::D 
 U:::::D     D:::::U M:::::::::::M     M:::::::::::M          A:::::A:::::A            T:::::T                T:::::T          E:::::E             N:::::::::::N   N::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M:::::::M::::M   M::::M:::::::M         A:::::A A:::::A           T:::::T                T:::::T          E::::::EEEEEEEEEE   N:::::::N::::N  N::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M M::::M M::::M M::::::M        A:::::A   A:::::A          T:::::T                T:::::T          E:::::::::::::::E   N::::::N N::::N N::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M  M::::M::::M  M::::::M       A:::::A     A:::::A         T:::::T                T:::::T          E:::::::::::::::E   N::::::N  N::::N:::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M   M:::::::M   M::::::M      A:::::AAAAAAAAA:::::A        T:::::T                T:::::T          E::::::EEEEEEEEEE   N::::::N   N:::::::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M    M:::::M    M::::::M     A:::::::::::::::::::::A       T:::::T                T:::::T          E:::::E             N::::::N    N::::::::::N  D:::::D     D:::::D
 U::::::U   U::::::U M::::::M     MMMMM     M::::::M    A:::::AAAAAAAAAAAAA:::::A      T:::::T                T:::::T          E:::::E       EEEEEEN::::::N     N:::::::::N  D:::::D    D:::::D 
 U:::::::UUU:::::::U M::::::M               M::::::M   A:::::A             A:::::A   TT:::::::TT            TT:::::::TT      EE::::::EEEEEEEE:::::EN::::::N      N::::::::NDDD:::::DDDDD:::::D  
  UU:::::::::::::UU  M::::::M               M::::::M  A:::::A               A:::::A  T:::::::::T            T:::::::::T      E::::::::::::::::::::EN::::::N       N:::::::ND:::::::::::::::DD   
    UU:::::::::UU    M::::::M               M::::::M A:::::A                 A:::::A T:::::::::T            T:::::::::T      E::::::::::::::::::::EN::::::N        N::::::ND::::::::::::DDD     
      UUUUUUUUU      MMMMMMMM               MMMMMMMMAAAAAAA                   AAAAAAATTTTTTTTTTT            TTTTTTTTTTT      EEEEEEEEEEEEEEEEEEEEEENNNNNNNN         NNNNNNNDDDDDDDDDDDDD  
  
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Server running in PRODUCTION mode
   Date/Time: ${now}
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      `;
    res.type("text/plain").send(asciiArt);
  });
}
if (NODE_ENV !== "PRODUCTION") {
  app.use((req, res) => {
    const now = (/* @__PURE__ */ new Date()).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
    const asciiArt = `
                                                                                                                                                                                                
                                                                                                                                                                                                
UUUUUUUU     UUUUUUUUMMMMMMMM               MMMMMMMM               AAA         TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTEEEEEEEEEEEEEEEEEEEEEENNNNNNNN        NNNNNNNNDDDDDDDDDDDDD        
U::::::U     U::::::UM:::::::M             M:::::::M              A:::A        T:::::::::::::::::::::TT:::::::::::::::::::::TE::::::::::::::::::::EN:::::::N       N::::::ND::::::::::::DDD     
U::::::U     U::::::UM::::::::M           M::::::::M             A:::::A       T:::::::::::::::::::::TT:::::::::::::::::::::TE::::::::::::::::::::EN::::::::N      N::::::ND:::::::::::::::DD   
UU:::::U     U:::::UUM:::::::::M         M:::::::::M            A:::::::A      T:::::TT:::::::TT:::::TT:::::TT:::::::TT:::::TEE::::::EEEEEEEEE::::EN:::::::::N     N::::::NDDD:::::DDDDD:::::D  
 U:::::U     U:::::U M::::::::::M       M::::::::::M           A:::::::::A     TTTTTT  T:::::T  TTTTTTTTTTTT  T:::::T  TTTTTT  E:::::E       EEEEEEN::::::::::N    N::::::N  D:::::D    D:::::D 
 U:::::D     D:::::U M:::::::::::M     M:::::::::::M          A:::::A:::::A            T:::::T                T:::::T          E:::::E             N:::::::::::N   N::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M:::::::M::::M   M::::M:::::::M         A:::::A A:::::A           T:::::T                T:::::T          E::::::EEEEEEEEEE   N:::::::N::::N  N::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M M::::M M::::M M::::::M        A:::::A   A:::::A          T:::::T                T:::::T          E:::::::::::::::E   N::::::N N::::N N::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M  M::::M::::M  M::::::M       A:::::A     A:::::A         T:::::T                T:::::T          E:::::::::::::::E   N::::::N  N::::N:::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M   M:::::::M   M::::::M      A:::::AAAAAAAAA:::::A        T:::::T                T:::::T          E::::::EEEEEEEEEE   N::::::N   N:::::::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M    M:::::M    M::::::M     A:::::::::::::::::::::A       T:::::T                T:::::T          E:::::E             N::::::N    N::::::::::N  D:::::D     D:::::D
 U::::::U   U::::::U M::::::M     MMMMM     M::::::M    A:::::AAAAAAAAAAAAA:::::A      T:::::T                T:::::T          E:::::E       EEEEEEN::::::N     N:::::::::N  D:::::D    D:::::D 
 U:::::::UUU:::::::U M::::::M               M::::::M   A:::::A             A:::::A   TT:::::::TT            TT:::::::TT      EE::::::EEEEEEEE:::::EN::::::N      N::::::::NDDD:::::DDDDD:::::D  
  UU:::::::::::::UU  M::::::M               M::::::M  A:::::A               A:::::A  T:::::::::T            T:::::::::T      E::::::::::::::::::::EN::::::N       N:::::::ND:::::::::::::::DD   
    UU:::::::::UU    M::::::M               M::::::M A:::::A                 A:::::A T:::::::::T            T:::::::::T      E::::::::::::::::::::EN::::::N        N::::::ND::::::::::::DDD     
      UUUUUUUUU      MMMMMMMM               MMMMMMMMAAAAAAA                   AAAAAAATTTTTTTTTTT            TTTTTTTTTTT      EEEEEEEEEEEEEEEEEEEEEENNNNNNNN         NNNNNNNDDDDDDDDDDDDD  
  
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Server running in DEVELOPMENT mode
   Date/Time: ${now}
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      `;
    res.type("text/plain").send(asciiArt);
  });
}
app.use(notFound);
app.use(errorHandler);
var app_default = app;

// src/cron/cleanupExpiredTokens.ts
import cron from "node-cron";
cron.schedule("0 */12 * * *", async () => {
  console.log("Running expired token cleanup...");
  try {
    const revokeTokens = await prisma_config_default.refresh_token.updateMany({
      where: {
        expires_at: {
          lt: /* @__PURE__ */ new Date()
        }
      },
      data: {
        is_active: false,
        revoked_at: /* @__PURE__ */ new Date()
      }
    });
    console.log(`Cleaned up ${revokeTokens.count} expired tokens.`);
  } catch (error) {
    console.error("Error during expired token cleanup:", error);
  }
});

// src/server.ts
var PORT2 = process.env.PORT;
var ENV = process.env.NODE_ENV;
app_default.listen(PORT2, () => {
  console.log(`Environment: ${ENV}`);
  console.log(`Server running on http://localhost:${PORT2}`);
});

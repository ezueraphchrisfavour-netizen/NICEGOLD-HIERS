const express = require("express");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const QRCode = require("qrcode");
const multer = require("multer");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// ========================================
// PATHS
// ========================================

const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const APPLICATIONS_FILE = path.join(
    DATA_DIR,
    "applications.json"
);

// ========================================
// CREATE FOLDERS / DATA FILE
// ========================================

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, {
        recursive: true
    });
}

if (!fs.existsSync(APPLICATIONS_FILE)) {
    fs.writeFileSync(
        APPLICATIONS_FILE,
        "[]",
        "utf8"
    );
}

// ========================================
// MIDDLEWARE
// ========================================

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);

// ========================================
// IMAGE UPLOAD
// ========================================

const storage = multer.diskStorage({

    destination: function (
        req,
        file,
        cb
    ) {

        cb(
            null,
            UPLOADS_DIR
        );

    },

    filename: function (
        req,
        file,
        cb
    ) {

        const extension =
            path.extname(
                file.originalname
            ).toLowerCase();

        const filename =
            "profile-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 8) +
            extension;

        cb(
            null,
            filename
        );

    }

});

const upload = multer({

    storage: storage,

    limits: {
        fileSize:
            5 * 1024 * 1024
    },

    fileFilter: function (
        req,
        file,
        cb
    ) {

        const allowedTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp"
        ];

        if (
            allowedTypes.includes(
                file.mimetype
            )
        ) {

            cb(
                null,
                true
            );

        } else {

            cb(
                new Error(
                    "Only JPG, PNG and WEBP images are allowed."
                )
            );

        }

    }

});

// ========================================
// STATIC FILES
// ========================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);

app.use(
    "/uploads",
    express.static(
        UPLOADS_DIR
    )
);

// ========================================
// APPLICATION FUNCTIONS
// ========================================

function getApplications() {

    try {

        if (
            !fs.existsSync(
                APPLICATIONS_FILE
            )
        ) {

            fs.writeFileSync(
                APPLICATIONS_FILE,
                "[]",
                "utf8"
            );

        }

        const raw =
            fs.readFileSync(
                APPLICATIONS_FILE,
                "utf8"
            );

        if (!raw.trim()) {
            return [];
        }

        const applications =
            JSON.parse(raw);

        if (
            !Array.isArray(
                applications
            )
        ) {

            return [];

        }

        return applications;

    } catch (error) {

        console.error(
            "GET APPLICATIONS ERROR:",
            error
        );

        return [];

    }

}

function saveApplications(
    applications
) {

    fs.writeFileSync(
        APPLICATIONS_FILE,
        JSON.stringify(
            applications,
            null,
            2
        ),
        "utf8"
    );

}

// ========================================
// ID GENERATORS
// ========================================

function generateApplicationId() {

    let id;

    do {

        id =
            "NGH-APP-" +
            Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase();

    } while (
        getApplications().some(
            application =>
                application.id === id
        )
    );

    return id;
}

function generateMemberId() {

    let id;

    do {

        id =
            "NGH-" +
            Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase();

    } while (
        getApplications().some(
            application =>
                application.memberId === id
        )
    );

    return id;
}

// ========================================
// HEALTH CHECK
// ========================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            ok: true,

            message:
                "NICEGOLD HIERS server is online.",

            time:
                new Date().toISOString()

        });

    }
);

// ========================================
// REGISTER
// ========================================

app.post(
    "/api/register",
    upload.single("profileImage"),
    (req, res) => {

        try {

            const name =
                String(
                    req.body.name || ""
                ).trim();

            const phone =
                String(
                    req.body.phone || ""
                ).trim();

            const gender =
                String(
                    req.body.gender || ""
                ).trim();

            const info =
                String(
                    req.body.info || ""
                ).trim();

            if (!name) {

                return res.status(400).json({
                    ok: false,
                    message:
                        "Full name is required."
                });

            }

            if (!phone) {

                return res.status(400).json({
                    ok: false,
                    message:
                        "Phone number is required."
                });

            }

            if (!gender) {

                return res.status(400).json({
                    ok: false,
                    message:
                        "Gender is required."
                });

            }

            if (!info) {

                return res.status(400).json({
                    ok: false,
                    message:
                        "Information is required."
                });

            }

            let profileImage = null;

            if (req.file) {

                profileImage =
                    "/uploads/" +
                    req.file.filename;

            }

            const applications =
                getApplications();

            const application = {

                id:
                    generateApplicationId(),

                name:
                    name,

                phone:
                    phone,

                gender:
                    gender,

                info:
                    info,

                profileImage:
                    profileImage,

                status:
                    "PENDING",

                submittedAt:
                    new Date().toISOString(),

                approvedAt:
                    null,

                memberId:
                    null,

                verificationDate:
                    null,

                rejectedAt:
                    null

            };

            applications.push(
                application
            );

            saveApplications(
                applications
            );

            res.status(201).json({

                ok: true,

                message:
                    "Application submitted successfully.",

                application:
                    application

            });

        } catch (error) {

            console.error(
                "REGISTER ERROR:",
                error
            );

            res.status(500).json({

                ok: false,

                message:
                    error.message ||
                    "Unable to submit application."

            });

        }

    }
);

// ========================================
// ADMIN: GET APPLICATIONS
// ========================================

app.get(
    "/api/admin/applications",
    (req, res) => {

        try {

            const applications =
                getApplications();

            res.json({

                ok: true,

                applications:
                    applications

            });

        } catch (error) {

            console.error(
                "ADMIN GET ERROR:",
                error
            );

            res.status(500).json({

                ok: false,

                message:
                    "Unable to load applications."

            });

        }

    }
);

// ========================================
// ADMIN: APPROVE
// ========================================

app.post(
    "/api/admin/applications/:id/approve",
    (req, res) => {

        try {

            const applications =
                getApplications();

            const application =
                applications.find(
                    item =>
                        String(item.id) ===
                        String(req.params.id)
                );

            if (!application) {

                return res.status(404).json({

                    ok: false,

                    message:
                        "Application not found."

                });

            }

            if (
                application.status ===
                "APPROVED"
            ) {

                return res.status(400).json({

                    ok: false,

                    message:
                        "This application is already approved.",

                    memberId:
                        application.memberId

                });

            }

            if (
                application.status ===
                "REJECTED"
            ) {

                return res.status(400).json({

                    ok: false,

                    message:
                        "This application has already been rejected."

                });

            }

            const memberId =
                generateMemberId();

            application.status =
                "APPROVED";

            application.memberId =
                memberId;

            application.approvedAt =
                new Date().toISOString();

            application.verificationDate =
                new Date().toISOString();

            saveApplications(
                applications
            );

            res.json({

                ok: true,

                message:
                    "Application approved successfully.",

                memberId:
                    memberId,

                application:
                    application

            });

        } catch (error) {

            console.error(
                "APPROVE ERROR:",
                error
            );

            res.status(500).json({

                ok: false,

                message:
                    error.message ||
                    "Unable to approve application."

            });

        }

    }
);

// ========================================
// ADMIN: REJECT
// ========================================

app.post(
    "/api/admin/applications/:id/reject",
    (req, res) => {

        try {

            const applications =
                getApplications();

            const application =
                applications.find(
                    item =>
                        String(item.id) ===
                        String(req.params.id)
                );

            if (!application) {

                return res.status(404).json({

                    ok: false,

                    message:
                        "Application not found."

                });

            }

            if (
                application.status ===
                "APPROVED"
            ) {

                return res.status(400).json({

                    ok: false,

                    message:
                        "An approved application cannot be rejected."

                });

            }

            application.status =
                "REJECTED";

            application.rejectedAt =
                new Date().toISOString();

            saveApplications(
                applications
            );

            res.json({

                ok: true,

                message:
                    "Application rejected successfully.",

                application:
                    application

            });

        } catch (error) {

            console.error(
                "REJECT ERROR:",
                error
            );

            res.status(500).json({

                ok: false,

                message:
                    error.message ||
                    "Unable to reject application."

            });

        }

    }
);

// ========================================
// VERIFY MEMBER
// ========================================

app.get(
    "/api/verify/:memberId",
    (req, res) => {

        try {

            const memberId =
                String(
                    req.params.memberId || ""
                ).trim();

            const applications =
                getApplications();

            const member =
                applications.find(
                    application =>
                        String(
                            application.memberId
                        ) === memberId &&
                        application.status ===
                        "APPROVED"
                );

            if (!member) {

                return res.status(404).json({

                    ok: false,

                    verified: false,

                    error:
                        "Member not found."

                });

            }

            res.json({

                ok: true,

                verified: true,

                member: {

                    name:
                        member.name,

                    phone:
                        member.phone,

                    gender:
                        member.gender,

                    info:
                        member.info,

                    profileImage:
                        member.profileImage,

                    memberId:
                        member.memberId,

                    status:
                        member.status,

                    approvedAt:
                        member.approvedAt,

                    verificationDate:
                        member.verificationDate

                }

            });

        } catch (error) {

            console.error(
                "VERIFY ERROR:",
                error
            );

            res.status(500).json({

                ok: false,

                verified: false,

                error:
                    "Unable to verify member."

            });

        }

    }
);

// ========================================
// QR CODE
// ========================================

app.get(
    "/api/qr/:memberId",
    async (req, res) => {

        try {

            const memberId =
                String(
                    req.params.memberId || ""
                ).trim();

            const applications =
                getApplications();

            const member =
                applications.find(
                    application =>
                        String(
                            application.memberId
                        ) === memberId &&
                        application.status ===
                        "APPROVED"
                );

            if (!member) {

                return res.status(404).json({

                    ok: false,

                    error:
                        "Member not found."

                });

            }

            const protocol =
                req.headers[
                    "x-forwarded-proto"
                ] ||
                req.protocol ||
                "http";

            const host =
                req.get("host");

            const verificationUrl =
                `${protocol}://${host}/verify.html?id=${encodeURIComponent(memberId)}`;

            const qr =
                await QRCode.toDataURL(
                    verificationUrl,
                    {
                        width: 500,
                        margin: 2
                    }
                );

            res.json({

                ok: true,

                memberId:
                    memberId,

                url:
                    verificationUrl,

                qr:
                    qr

            });

        } catch (error) {

            console.error(
                "QR ERROR:",
                error
            );

            res.status(500).json({

                ok: false,

                error:
                    "Unable to generate QR code."

            });

        }

    }
);

// ========================================
// API 404
// ========================================

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            ok: false,

            message:
                "API endpoint not found."

        });

    }
);

// ========================================
// GENERAL 404
// ========================================

app.use(
    (req, res) => {

        res.status(404).send(
            "Page not found."
        );

    }
);

// ========================================
// ERROR HANDLER
// ========================================

app.use(
    (error, req, res, next) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        if (
            error instanceof
            multer.MulterError
        ) {

            return res.status(400).json({

                ok: false,

                message:
                    "Image upload failed."

            });

        }

        res.status(500).json({

            ok: false,

            message:
                error.message ||
                "Internal server error."

        });

    }
);

// ========================================
// START SERVER
// ========================================

app.listen(
    PORT,
    HOST,
    () => {

        console.log(
            "======================================"
        );

        console.log(
            "✞𓉳 ⃝𝗡𝗜𝗖𝗘𝗚𝗢𝗟𝗗₊ ⃝ ＨＩＥＲＳ.𓃵"
        );

        console.log(
            "======================================"
        );

        console.log(
            "Server running on port " +
            PORT
        );

        console.log(
            "http://127.0.0.1:" +
            PORT
        );

    }
);
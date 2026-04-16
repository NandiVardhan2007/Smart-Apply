import logging
from datetime import datetime, timezone
from app.db.mongodb import get_database
from bson import ObjectId

logger = logging.getLogger(__name__)

class AdminService:
    @staticmethod
    async def log_admin_action(admin_id: str, action: str, entity_id: str = None, metadata: dict = None):
        """
        Asynchronously logs admin actions into the audit_logs collection.
        Designed to be run as a BackgroundTask so it never blocks the main response.
        """
        try:
            db = get_database()
            log_entry = {
                "admin_id": admin_id,
                "action": action,
                "entity_id": entity_id,
                "timestamp": datetime.now(timezone.utc),
                "metadata": metadata or {}
            }
            await db.audit_logs.insert_one(log_entry)
        except Exception as e:
            logger.error(f"Failed to write audit log for admin {admin_id}: {e}", exc_info=True)

    @staticmethod
    async def get_dashboard_metrics() -> dict:
        """
        Gathers safe, non-blocking metrics for the admin dashboard.
        """
        db = get_database()
        
        total_users = await db.users.count_documents({})
        banned_users = await db.users.count_documents({"is_banned": True})
        
        total_apps = await db.applications.count_documents({})
        
        # Consider a user active if they have verified emails, or based on recent logins if logged
        active_users = await db.users.count_documents({"is_verified": True})
        
        # New: Email metrics
        total_emails = await db.email_logs.count_documents({})
        failed_emails = await db.email_logs.count_documents({"status": "failed"})
        
        # New: AI Usage tracking
        total_ats_scans = await db.ats_scans.count_documents({})
        total_jarvis_reports = await db.feedbacks.count_documents({})
        ai_operations = total_ats_scans + total_jarvis_reports

        return {
            "total_users": total_users,
            "active_users": active_users,
            "banned_users": banned_users,
            "total_applications": total_apps,
            "total_emails_sent": total_emails,
            "failed_emails": failed_emails,
            "ai_operations": ai_operations
        }

    @staticmethod
    async def get_email_logs(skip: int = 0, limit: int = 50) -> list:
        """
        Retrieves the latest filtered email notification logs.
        """
        db = get_database()
        cursor = db.email_logs.find({}).sort("timestamp", -1).skip(skip).limit(limit)
        logs = await cursor.to_list(length=limit)
        
        for log in logs:
            log["id"] = str(log["_id"])
            del log["_id"]
        return logs

    @staticmethod
    async def get_feedbacks(skip: int = 0, limit: int = 50) -> list:
        """
        Retrieves user feedbacks and reports.
        """
        db = get_database()
        cursor = db.feedbacks.find({}).sort("created_at", -1).skip(skip).limit(limit)
        feedbacks = await cursor.to_list(length=limit)
        
        for f in feedbacks:
            f["id"] = str(f["_id"])
            del f["_id"]
        return feedbacks

    @staticmethod
    async def reply_to_feedback(feedback_id: str, message: str) -> bool:
        """
        Sends an official response to user feedback and updates status.
        """
        from app.services.email import email_service
        from app.services.email_templates import get_support_reply_html
        
        db = get_database()
        feedback = await db.feedbacks.find_one({"_id": ObjectId(feedback_id)})
        if not feedback:
            return False
            
        # 1. Send Email
        html_content = get_support_reply_html(message)
        success = await email_service.send_email(
            recipient_email=feedback["user_email"],
            subject="Response to your Smart Apply feedback",
            html_content=html_content
        )
        
        if success:
            # 2. Update status in DB
            await db.feedbacks.update_one(
                {"_id": ObjectId(feedback_id)},
                {"$set": {
                    "status": "replied",
                    "replied_at": datetime.now(timezone.utc),
                    "reply_content": message
                }}
            )
            return True
        return False

admin_service = AdminService()

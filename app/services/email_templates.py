from typing import Optional

def get_welcome_email_html(full_name: Optional[str] = "there") -> str:
    name = full_name if full_name else "there"
    
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
        }}
        .container {{
            max-width: 600px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
        }}
        .header {{
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            padding: 40px 20px;
            text-align: center;
            color: #ffffff;
        }}
        .header h1 {{
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.025em;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .content p {{
            margin-bottom: 24px;
            font-size: 16px;
            color: #475569;
        }}
        .content h2 {{
            color: #1e293b;
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 16px;
        }}
        .feature-list {{
            margin: 32px 0;
            padding: 0;
            list-style: none;
        }}
        .feature-item {{
            display: flex;
            align-items: center;
            margin-bottom: 16px;
        }}
        .feature-icon {{
            background: #eef2ff;
            color: #4f46e5;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            font-weight: bold;
        }}
        .cta-button {{
            display: inline-block;
            background-color: #4f46e5;
            color: #ffffff !important;
            padding: 14px 28px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 10px;
            transition: background-color 0.2s;
        }}
        .footer {{
            background-color: #f1f5f9;
            padding: 30px;
            text-align: center;
            font-size: 14px;
            color: #64748b;
        }}
        .social-links {{
            margin-top: 20px;
        }}
        .social-links a {{
            color: #94a3b8;
            margin: 0 10px;
            text-decoration: none;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Smart Apply! 🚀</h1>
        </div>
        <div class="content">
            <h2>Hi {name},</h2>
            <p>Welcome to the future of job applications! We're thrilled to have you on board. Smart Apply is designed to make your job search easier, faster, and more effective using AI-powered tools.</p>
            
            <p>Here's what you can do next:</p>
            
            <div class="feature-list">
                <div class="feature-item">
                    <div class="feature-icon">1</div>
                    <div><strong>Complete your profile:</strong> Enrich your profile for better AI matching.</div>
                </div>
                <div class="feature-item">
                    <div class="feature-icon">2</div>
                    <div><strong>Upload your resume:</strong> Let our AI analyze and optimize it for ATS.</div>
                </div>
                <div class="feature-item">
                    <div class="feature-icon">3</div>
                    <div><strong>Track applications:</strong> Keep all your job pursuits in one organized place.</div>
                </div>
            </div>

            <p>Ready to get started?</p>
            <a href="https://smart-apply.vercel.app/dashboard" class="cta-button">Go to Dashboard</a>
            
            <p style="margin-top: 32px;">If you have any questions, just reply to this email. We're here to help!</p>
            <p>Best regards,<br>The Smart Apply Team</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 Smart Apply Inc. All rights reserved.</p>
            <p>Making job hunting human-centric again.</p>
            <div class="social-links">
                <a href="#">Twitter</a>
                <a href="#">LinkedIn</a>
                <a href="#">Instagram</a>
            </div>
        </div>
    </div>
</body>
</html>
"""

def get_welcome_email_text(full_name: Optional[str] = "there") -> str:
    name = full_name if full_name else "there"
    return f"""
Hi {name},

Welcome to Smart Apply! 🚀

We're thrilled to have you on board. Smart Apply is designed to make your job search easier, faster, and more effective using AI-powered tools.

Here's what you can do next:
1. Complete your profile: Enrich your profile for better AI matching.
2. Upload your resume: Let our AI analyze and optimize it for ATS.
3. Track applications: Keep all your job pursuits in one organized place.

Ready to get started? Go to: https://smart-apply.vercel.app/dashboard

If you have any questions, just reply to this email. We're here to help!

Best regards,
The Smart Apply Team
"""

def get_otp_email_html(otp: str, purpose: str = "verification") -> str:
    action_text = "verify your email" if purpose == "verification" else "reset your password"
    title = "Verification Code" if purpose == "verification" else "Password Reset Code"
    
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
        }}
        .container {{
            max-width: 600px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
        }}
        .header {{
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            padding: 40px 20px;
            text-align: center;
            color: #ffffff;
        }}
        .header h1 {{
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.025em;
        }}
        .content {{
            padding: 40px 30px;
            text-align: center;
        }}
        .content p {{
            margin-bottom: 24px;
            font-size: 16px;
            color: #475569;
        }}
        .otp-container {{
            background-color: #f1f5f9;
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            letter-spacing: 8px;
            font-size: 36px;
            font-weight: 800;
            color: #4f46e5;
            border: 2px dashed #e2e8f0;
        }}
        .footer {{
            background-color: #f1f5f9;
            padding: 30px;
            text-align: center;
            font-size: 14px;
            color: #64748b;
        }}
        .expiry-text {{
            font-size: 13px;
            color: #94a3b8;
            margin-top: 16px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{title}</h1>
        </div>
        <div class="content">
            <p>Please use the following single-use code to {action_text}.</p>
            <div class="otp-container">
                {otp}
            </div>
            <p>For security, do not share this code with anyone.</p>
            <p class="expiry-text">This code will expire in 10 minutes.</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 Smart Apply Inc. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""

def get_otp_email_text(otp: str, purpose: str = "verification") -> str:
    action_text = "verify your email" if purpose == "verification" else "reset your password"
    title = "Verification Code" if purpose == "verification" else "Password Reset Code"
    return f"""
{title}

Please use the following single-use code to {action_text}:

{otp}

This code will expire in 10 minutes. For security, do not share this code with anyone.

Best regards,
The Smart Apply Team
"""
def get_support_reply_html(message: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
        }}
        .container {{
            max-width: 600px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
            overflow: hidden;
        }}
        .header {{
            background: #4f46e5;
            padding: 30px;
            text-align: center;
            color: #ffffff;
        }}
        .content {{
            padding: 40px;
        }}
        .reply-box {{
            background-color: #f1f5f9;
            padding: 24px;
            border-radius: 12px;
            border-left: 4px solid #4f46e5;
            margin: 24px 0;
            font-style: italic;
        }}
        .footer {{
            padding: 30px;
            text-align: center;
            font-size: 14px;
            color: #64748b;
            background: #f8fafc;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin:0">Smart Apply Support</h2>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Our team has reviewed your recent feedback. Below is a response from our administrator:</p>
            
            <div class="reply-box">
                {message}
            </div>
            
            <p>We hope this addresses your concerns. If you have any further questions, please don't hesitate to reach out.</p>
            <p>Best regards,<br>The Smart Apply Team</p>
        </div>
        <div class="footer">
            <p>&copy; 2026 Smart Apply Inc. | Performance & AI-Driven Career Growth</p>
        </div>
    </div>
</body>
</html>
"""

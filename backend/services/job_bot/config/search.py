###################################################### LINKEDIN SEARCH PREFERENCES ######################################################

search_terms = [
    "Business Analyst",
    "Financial Analyst",
    "Finance Executive",
    "Management Trainee",
    "Marketing Analyst",
    "Sales Analyst",
    "CRM Executive",
    "Operations Analyst",
    "Business Operations Associate",
    "Data Analyst Fresher",
    "MBA Fresher",
    "Finance Graduate Trainee",
    "Junior Business Analyst",
    "Sales Executive Fresher",
    "Junior Financial Analyst",
    "Graduate Trainee Finance"
]

search_location = "India"

switch_number = 15                 # ANTI-DETECTION: reduced from 40 → apply to 15 per keyword, then rotate

randomize_search_order = True


# >>>>>>>>>>> Job Search Filters <<<<<<<<<<<

sort_by = "Most recent"
date_posted = "Past month"         # Changed from "Past week" — catches more fresher postings
salary = ""

easy_apply_only = True

experience_level = ["Internship", "Entry level", "Associate"]
job_type = ["Full-time", "Internship"]
on_site = ["On-site", "Hybrid", "Remote"]

# Removed company filter — was limiting results to only 10 companies
companies = []

location = []                      # Handled by search_location above

industry = [
    "Financial Services",
    "Banking",
    "IT Services and IT Consulting",
    "Business Consulting and Services",
    "Advertising Services"
]

job_function = [
    "Finance",
    "Business Development",
    "Marketing",
    "Operations",
    "Sales"
]

job_titles = []
benefits = []
commitments = []

under_10_applicants = True
in_your_network = False
fair_chance_employer = False


## >>>>>>>>>>> RELATED SETTING <<<<<<<<<<<

pause_after_filters = True


## >>>>>>>>>>> SKIP IRRELEVANT JOBS <<<<<<<<<<<

about_company_bad_words = ["Crossover"]

about_company_good_words = []

bad_words = [
    "US Citizen",
    "USA Citizen",
    "No C2C",
    "No Corp2Corp",
    "Senior 10+ Years",
    "10+ years",
    "15+ years"
]
# Removed "Security Clearance" from bad_words — handled smarter below via security_clearance flag
# Removed "No C2C" duplicate entries

security_clearance = False

did_masters = False

# Increased from 1 to 3 — with did_masters=True, bot gets +2 bonus so handles up to 5 yrs exp
# This stops over-skipping freshers-welcome roles worded as "up to 3 years"
current_experience = 0
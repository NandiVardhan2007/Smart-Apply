###################################################### CONFIGURE YOUR BOT HERE ######################################################

# >>>>>>>>>>> LinkedIn Settings <<<<<<<<<<<

# Keep the External Application tabs open?
close_tabs = False                  # True or False

# Follow easy applied companies
follow_companies = False            # True or False

# Run continuously until you stop it
run_non_stop = True                 # Enabled — bot keeps cycling through all search terms

alternate_sortby = True             # Alternates between Most Recent / Most Relevant each cycle
cycle_date_posted = True            # Cycles through date ranges each run
stop_date_cycle_at_24hr = True


# >>>>>>>>>>> RESUME GENERATOR (Experimental & In Development) <<<<<<<<<<<

generated_resume_path = "all resumes/"


# >>>>>>>>>>> Global Settings <<<<<<<<<<<

file_name = "all_excels/applied_jobs.csv"
failed_file_name = "all_excels/failed_jobs.csv"
logs_folder_path = "logs/"

click_gap = 3                       # ANTI-DETECTION: increased from 1 → 1.8–3.0s human-like gap between actions

run_in_background = False

disable_extensions = False

safe_mode = True

smooth_scroll = True                # ANTI-DETECTION: natural scrolling behaviour (was False)

keep_screen_awake = True

stealth_mode = True                 # ANTI-DETECTION: patches navigator.webdriver flag LinkedIn checks (was False)

showAiErrorAlerts = False
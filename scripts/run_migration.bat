@echo off
echo Running migration: Add accessed_at column to user_access...
docker exec elearning_mysql mysql -u elearning -pelearning123 elearning -e "ALTER TABLE user_access ADD COLUMN accessed_at TIMESTAMP NULL DEFAULT NULL;"
IF %ERRORLEVEL% EQU 0 (
    echo [OK] Column added successfully!
) ELSE (
    echo [INFO] Column may already exist or there was an error.
)
docker exec elearning_mysql mysql -u elearning -pelearning123 elearning -e "DESCRIBE user_access;"
pause

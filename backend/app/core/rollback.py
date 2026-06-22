import os
import tarfile
import shutil
import datetime
from typing import Optional
from sqlalchemy.orm import Session
from ..models import RollbackSnapshot

class RollbackEngine:
    BACKUP_DIR = os.path.expanduser("~/.safeops/backups")

    @classmethod
    def get_backup_path(cls, name: str) -> str:
        """
        Creates backup folder and returns a versioned archive filename path.
        """
        os.makedirs(cls.BACKUP_DIR, exist_ok=True)
        timestamp = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
        return os.path.join(cls.BACKUP_DIR, f"{name}_{timestamp}.tar.gz")

    @classmethod
    def create_directory_backup(cls, target_dir: str, name: str) -> Optional[str]:
        """
        Creates a compressed tarball archive of a target directory if it exists.
        Returns the path to the backup archive file.
        """
        target_path = os.path.expanduser(target_dir)
        if not os.path.exists(target_path):
            # Target path doesn't exist yet, so rollback is as simple as deleting it if created.
            return "target_does_not_exist"

        backup_file = cls.get_backup_path(name)
        try:
            with tarfile.open(backup_file, "w:gz") as tar:
                # Add directory content with relative path structure
                tar.add(target_path, arcname=os.path.basename(target_path))
            return backup_file
        except Exception:
            # Backup creation failed, abort to prevent running the command without safe recovery
            return None

    @classmethod
    def restore_directory_backup(cls, archive_path: str, target_dir: str) -> bool:
        """
        Restores a directory to its previous state using the backup archive.
        """
        target_path = os.path.expanduser(target_dir)
        try:
            if archive_path == "target_does_not_exist":
                # Revert: Delete the directory created during execution
                if os.path.exists(target_path):
                    if os.path.isdir(target_path):
                        shutil.rmtree(target_path)
                    else:
                        os.remove(target_path)
                return True

            if not os.path.exists(archive_path):
                return False

            # Delete the current broken state first
            if os.path.exists(target_path):
                if os.path.isdir(target_path):
                    shutil.rmtree(target_path)
                else:
                    os.remove(target_path)

            # Unpack the backup tarball to its parent directory
            parent_dir = os.path.dirname(target_path)
            os.makedirs(parent_dir, exist_ok=True)
            with tarfile.open(archive_path, "r:gz") as tar:
                tar.extractall(path=parent_dir)
            return True
        except Exception:
            return False

    @classmethod
    def register_snapshot(
        cls, 
        db: Session, 
        execution_id: str, 
        snapshot_type: str, 
        target_dir: str,
        backup_path: str
    ) -> RollbackSnapshot:
        """
        Saves the rollback snapshot details in the database.
        """
        snapshot = RollbackSnapshot(
            execution_id=execution_id,
            snapshot_type=snapshot_type,
            snapshot_target=f"{target_dir}|{backup_path}"
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        return snapshot

    @classmethod
    def trigger_rollback(cls, db: Session, snapshot: RollbackSnapshot) -> bool:
        """
        Resolves the snapshot target details and restores system state.
        """
        if snapshot.is_rolled_back:
            return True

        try:
            target_dir, archive_path = snapshot.snapshot_target.split("|", 1)
            success = cls.restore_directory_backup(archive_path, target_dir)
            
            if success:
                snapshot.is_rolled_back = True
                snapshot.rolled_back_at = datetime.datetime.utcnow()
                db.commit()
                return True
        except Exception:
            pass
        return False

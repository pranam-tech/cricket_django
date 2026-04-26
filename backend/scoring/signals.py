from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        has_existing_manager = UserProfile.objects.filter(
            user_type__in=[UserProfile.ADMIN, UserProfile.MANAGER]
        ).exists()
        user_type = UserProfile.ADMIN if instance.is_superuser else UserProfile.USER
        if not instance.is_superuser and not has_existing_manager:
            user_type = UserProfile.MANAGER
        UserProfile.objects.create(user=instance, user_type=user_type)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    profile, _ = UserProfile.objects.get_or_create(user=instance)
    if instance.is_superuser and profile.user_type != UserProfile.ADMIN:
        profile.user_type = UserProfile.ADMIN
        profile.save(update_fields=['user_type'])
    instance.profile.save()

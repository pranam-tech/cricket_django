from rest_framework.permissions import SAFE_METHODS, BasePermission


def get_user_type(user):
    if not user or not user.is_authenticated:
        return None
    profile = getattr(user, 'profile', None)
    return getattr(profile, 'user_type', None)


class IsManagerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        user_type = get_user_type(request.user)
        return user_type in {'admin', 'manager'}


class CanScoreLiveMatches(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user.is_authenticated
        user_type = get_user_type(request.user)
        return user_type in {'admin', 'scorekeeper'}


class AuthenticatedReadOnlyOrManager(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user.is_authenticated
        user_type = get_user_type(request.user)
        return user_type in {'admin', 'manager'}

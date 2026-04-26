from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginView,
    LogoutView,
    MatchViewSet,
    MeView,
    RegisterView,
    InningsViewSet,
    ScorekeeperRequestViewSet,
    TournamentViewSet,
)

router = DefaultRouter()
router.register(r'tournaments', TournamentViewSet, basename='tournament')
router.register(r'matches', MatchViewSet)
router.register(r'innings', InningsViewSet)
router.register(r'scorekeeper-requests', ScorekeeperRequestViewSet, basename='scorekeeper-request')

urlpatterns = [
    path('auth/register/', RegisterView.as_view()),
    path('auth/login/', LoginView.as_view()),
    path('auth/logout/', LogoutView.as_view()),
    path('auth/me/', MeView.as_view()),
    path('', include(router.urls)),
]

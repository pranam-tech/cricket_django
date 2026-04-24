from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MatchViewSet, InningsViewSet

router = DefaultRouter()
router.register(r'matches', MatchViewSet)
router.register(r'innings', InningsViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

"""
Test cases for the HTTP endpoints of the profile image api.
"""
from contextlib import closing
import unittest

import ddt
from django.conf import settings
from django.core.urlresolvers import reverse
import mock
from mock import patch

from PIL import Image
from rest_framework.test import APITestCase, APIClient

from student.tests.factories import UserFactory

from ...user_api.accounts.image_helpers import (
    set_profile_image_version,
    get_profile_image_names,
    get_profile_image_storage,
)
from ..images import create_profile_images, ImageValidationError
from .helpers import make_image_file

TEST_PASSWORD = "test"
TEST_VERSION = "123"


class ProfileImageEndpointTestCase(APITestCase):
    """
    Base class / shared infrastructure for tests of profile_image "upload" and
    "remove" endpoints.
    """
    # subclasses should override this with the name of the view under test, as
    # per the urls.py configuration.
    _view_name = None

    def setUp(self):
        super(ProfileImageEndpointTestCase, self).setUp()
        self.user = UserFactory.create(password=TEST_PASSWORD)
        # Ensure that parental controls don't apply to this user
        self.user.profile.year_of_birth = 1980
        self.user.profile.save()
        self.url = reverse(self._view_name, kwargs={'username': self.user.username})
        self.client.login(username=self.user.username, password=TEST_PASSWORD)
        self.storage = get_profile_image_storage()
        # this assertion is made here as a sanity check because all tests
        # assume user.profile.has_profile_image is False by default
        self.assertFalse(self.user.profile.has_profile_image)

    def tearDown(self):
        super(ProfileImageEndpointTestCase, self).tearDown()
        for name in get_profile_image_names(self.user.username).values():
            self.storage.delete(name)

    def check_images(self, exist=True):
        """
        If exist is True, make sure the images physically exist in storage
        with correct sizes and formats.

        If exist is False, make sure none of the images exist.
        """
        for size, name in get_profile_image_names(self.user.username).items():
            if exist:
                self.assertTrue(self.storage.exists(name))
                with closing(Image.open(self.storage.path(name))) as img:
                    self.assertEqual(img.size, (size, size))
                    self.assertEqual(img.format, 'JPEG')
            else:
                self.assertFalse(self.storage.exists(name))

    def check_response(self, response, expected_code, expected_developer_message=None, expected_user_message=None):
        """
        Make sure the response has the expected code, and if that isn't 204,
        optionally check the correctness of a developer-facing message.
        """
        self.assertEqual(expected_code, response.status_code)
        if expected_code == 204:
            self.assertIsNone(response.data)
        else:
            if expected_developer_message is not None:
                self.assertEqual(response.data.get('developer_message'), expected_developer_message)
            if expected_user_message is not None:
                self.assertEqual(response.data.get('user_message'), expected_user_message)

    def check_has_profile_image(self, has_profile_image=True):
        """
        Make sure the value of self.user.profile.has_profile_image is what we
        expect.
        """
        # it's necessary to reload this model from the database since save()
        # would have been called on another instance.
        profile = self.user.profile.__class__.objects.get(user=self.user)
        self.assertEqual(profile.has_profile_image, has_profile_image)


@ddt.ddt
@unittest.skipUnless(settings.ROOT_URLCONF == 'lms.urls', 'Profile Image API is only supported in LMS')
class ProfileImageUploadTestCase(ProfileImageEndpointTestCase):
    """
    Tests for the profile_image upload endpoint.
    """
    _view_name = "profile_image_upload"

    def test_unsupported_methods(self):
        """
        Test that GET, PUT, PATCH, and DELETE are not supported.
        """
        self.assertEqual(405, self.client.get(self.url).status_code)
        self.assertEqual(405, self.client.put(self.url).status_code)
        self.assertEqual(405, self.client.patch(self.url).status_code)
        self.assertEqual(405, self.client.delete(self.url).status_code)

    def test_anonymous_access(self):
        """
        Test that an anonymous client (not logged in) cannot POST.
        """
        anonymous_client = APIClient()
        response = anonymous_client.post(self.url)
        self.assertEqual(401, response.status_code)

    @patch('openedx.core.djangoapps.profile_images.views._make_image_version', return_value=TEST_VERSION)
    def test_upload_self(self, mock_make_image_version):
        """
        Test that an authenticated user can POST to their own upload endpoint.
        """
        with make_image_file() as image_file:
            response = self.client.post(self.url, {'file': image_file}, format='multipart')
            self.check_response(response, 204)
            self.check_images()
            self.check_has_profile_image()

    def test_upload_other(self):
        """
        Test that an authenticated user cannot POST to another user's upload endpoint.
        """
        different_user = UserFactory.create(password=TEST_PASSWORD)
        different_client = APIClient()
        different_client.login(username=different_user.username, password=TEST_PASSWORD)
        with make_image_file() as image_file:
            response = different_client.post(self.url, {'file': image_file}, format='multipart')
            self.check_response(response, 404)
            self.check_images(False)
            self.check_has_profile_image(False)

    def test_upload_staff(self):
        """
        Test that an authenticated staff cannot POST to another user's upload endpoint.
        """
        staff_user = UserFactory(is_staff=True, password=TEST_PASSWORD)
        staff_client = APIClient()
        staff_client.login(username=staff_user.username, password=TEST_PASSWORD)
        with make_image_file() as image_file:
            response = staff_client.post(self.url, {'file': image_file}, format='multipart')
            self.check_response(response, 403)
            self.check_images(False)
            self.check_has_profile_image(False)

    def test_upload_missing_file(self):
        """
        Test that omitting the file entirely from the POST results in HTTP 400.
        """
        response = self.client.post(self.url, {}, format='multipart')
        self.check_response(
            response, 400,
            expected_developer_message=u"No file provided for profile image",
            expected_user_message=u"No file provided for profile image",
        )
        self.check_images(False)
        self.check_has_profile_image(False)

    def test_upload_not_a_file(self):
        """
        Test that sending unexpected data that isn't a file results in HTTP
        400.
        """
        response = self.client.post(self.url, {'file': 'not a file'}, format='multipart')
        self.check_response(
            response, 400,
            expected_developer_message=u"No file provided for profile image",
            expected_user_message=u"No file provided for profile image",
        )
        self.check_images(False)
        self.check_has_profile_image(False)

    def test_upload_validation(self):
        """
        Test that when upload validation fails, the proper HTTP response and
        messages are returned.
        """
        with make_image_file() as image_file:
            with mock.patch(
                'openedx.core.djangoapps.profile_images.views.validate_uploaded_image',
                side_effect=ImageValidationError(u"test error message")
            ):
                response = self.client.post(self.url, {'file': image_file}, format='multipart')
                self.check_response(
                    response, 400,
                    expected_developer_message=u"test error message",
                    expected_user_message=u"test error message",
                )
                self.check_images(False)
                self.check_has_profile_image(False)

    @patch('PIL.Image.open')
    def test_upload_failure(self, image_open):
        """
        Test that when upload validation fails, the proper HTTP response and
        messages are returned.
        """
        image_open.side_effect = [Exception(u"whoops"), None]
        with make_image_file() as image_file:
            response = self.client.post(self.url, {'file': image_file}, format='multipart')
            self.check_response(
                response, 400,
                expected_developer_message=u"Upload failed for profile image: whoops",
                expected_user_message=u"Upload failed for profile image",
            )
            self.check_images(False)
            self.check_has_profile_image(False)


@unittest.skipUnless(settings.ROOT_URLCONF == 'lms.urls', 'Profile Image API is only supported in LMS')
class ProfileImageRemoveTestCase(ProfileImageEndpointTestCase):
    """
    Tests for the profile_image remove endpoint.
    """
    _view_name = "profile_image_remove"

    def setUp(self):
        super(ProfileImageRemoveTestCase, self).setUp()
        with make_image_file() as image_file:
            create_profile_images(image_file, get_profile_image_names(self.user.username))
            self.check_images()
            set_profile_image_version(self.user.username, TEST_VERSION)

    def test_unsupported_methods(self):
        """
        Test that GET, PUT, PATCH, and DELETE are not supported.
        """
        self.assertEqual(405, self.client.get(self.url).status_code)
        self.assertEqual(405, self.client.put(self.url).status_code)
        self.assertEqual(405, self.client.patch(self.url).status_code)
        self.assertEqual(405, self.client.delete(self.url).status_code)

    def test_anonymous_access(self):
        """
        Test that an anonymous client (not logged in) cannot call GET or POST.
        """
        anonymous_client = APIClient()
        for request in (anonymous_client.get, anonymous_client.post):
            response = request(self.url)
            self.assertEqual(401, response.status_code)

    def test_remove_self(self):
        """
        Test that an authenticated user can POST to remove their own profile
        images.
        """
        response = self.client.post(self.url)
        self.check_response(response, 204)
        self.check_images(False)
        self.check_has_profile_image(False)

    def test_remove_other(self):
        """
        Test that an authenticated user cannot POST to remove another user's
        profile images.
        """
        different_user = UserFactory.create(password=TEST_PASSWORD)
        different_client = APIClient()
        different_client.login(username=different_user.username, password=TEST_PASSWORD)
        response = different_client.post(self.url)
        self.check_response(response, 404)
        self.check_images(True)  # thumbnails should remain intact.
        self.check_has_profile_image(True)

    def test_remove_staff(self):
        """
        Test that an authenticated staff user can POST to remove another user's
        profile images.
        """
        staff_user = UserFactory(is_staff=True, password=TEST_PASSWORD)
        staff_client = APIClient()
        staff_client.login(username=staff_user.username, password=TEST_PASSWORD)
        response = self.client.post(self.url)
        self.check_response(response, 204)
        self.check_images(False)
        self.check_has_profile_image(False)

    @patch('student.models.UserProfile.save')
    def test_remove_failure(self, user_profile_save):
        """
        Test that when upload validation fails, the proper HTTP response and
        messages are returned.
        """
        user_profile_save.side_effect = [Exception(u"whoops"), None]
        response = self.client.post(self.url)
        self.check_response(
            response, 400,
            expected_developer_message=u"Delete failed for profile image: whoops",
            expected_user_message=u"Delete failed for profile image",
        )
        self.check_images(True)  # thumbnails should remain intact.
        self.check_has_profile_image(True)
